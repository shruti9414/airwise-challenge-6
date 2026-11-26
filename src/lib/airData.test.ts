import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CACHE_TTL_MS,
  currentReading,
  isStale,
  isValidAirData,
  loadLive,
  parseAirQuality,
  readCache,
  reverseGeocode,
  sampleData,
  searchPlaces,
} from './airData'
import type { Place } from '../types'

const place: Place = { name: 'Delhi', lat: 28.61, lon: 77.21, kind: 'city' }
const hours = (n: number) =>
  Array.from({ length: n }, (_, i) => `2026-11-${i < 24 ? 25 : 26}T${String(i % 24).padStart(2, '0')}:00`)
const payload = (pm25 = 120) => ({
  utc_offset_seconds: 19800,
  current: { time: '2026-11-26T10:00' },
  hourly: {
    time: hours(48),
    pm2_5: Array(48).fill(pm25),
    pm10: Array(48).fill(200),
    nitrogen_dioxide: Array(48).fill(40),
    ozone: Array(48).fill(30),
    sulphur_dioxide: Array(48).fill(10),
    carbon_monoxide: Array(48).fill(600),
  },
})
const CACHE_KEY = 'airwise:cache:28.61,77.21'
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

describe('air data parsing', () => {
  it('parses a valid response and locates the current hour', () => {
    const d = parseAirQuality(payload(), null, 0)
    expect(d.source).toBe('live')
    expect(d.nowIndex).toBe(34)
    expect(d.observedAt).toBe(Date.UTC(2026, 10, 26, 10, 0) - 19800 * 1000)
    expect(currentReading(d).band).toBe('poor')
  })

  it('builds the headline AQI from CPCB averages, not from the current hour', () => {
    const p = payload()
    p.hourly.pm2_5 = Array.from({ length: 48 }, (_, i) => (i < 24 ? 200 : 20))
    const r = currentReading(parseAirQuality(p, null, 0))
    expect(r.pollutants.pm25).toBeCloseTo(117.5)
    expect(r.band).toBe('poor')
  })

  it('shows the AQI as unavailable when there are fewer than 16 hours of data', () => {
    const early = payload()
    early.current.time = '2026-11-25T10:00'
    expect(currentReading(parseAirQuality(early, null, 0))).toMatchObject({ aqi: null, band: null })
  })

  it('shows the AQI as unavailable with fewer than three pollutants', () => {
    const p = payload()
    for (const k of ['nitrogen_dioxide', 'ozone', 'sulphur_dioxide', 'carbon_monoxide'] as const)
      p.hourly[k] = Array(48).fill(null)
    expect(currentReading(parseAirQuality(p, null, 0)).aqi).toBeNull()
  })

  it('rejects malformed payloads', () => {
    expect(() => parseAirQuality({}, null)).toThrow()
    expect(() => parseAirQuality({ ...payload(), current: { time: '2020-01-01T00:00' } }, null)).toThrow()
  })

  it('treats non-numeric values as missing', () => {
    const p = payload()
    ;(p.hourly.pm2_5 as unknown[])[34] = 'x'
    expect(parseAirQuality(p, null).hourly[34]!.pm25).toBeNull()
  })
})

describe('live loading, caching and errors', () => {
  it('fetches, caches, then serves from cache without another request', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async (url: string) =>
        ok(
          url.includes('air-quality')
            ? payload()
            : { current: { temperature_2m: 10, relative_humidity_2m: 50, wind_speed_10m: 3 } },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)
    const first = await loadLive(place)
    expect(first.fromCache).toBe(false)
    expect(first.data.weather?.windSpeed).toBe(3)
    const calls = fetchMock.mock.calls.length
    const second = await loadLive(place)
    expect(second.fromCache).toBe(true)
    expect(fetchMock.mock.calls.length).toBe(calls)
  })

  it('throws a readable error when the service fails and nothing is cached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 } as Response))
    await expect(loadLive(place)).rejects.toThrow(/503/)
  })

  it('falls back to older cached data when the network fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (u: string) => ok(u.includes('air-quality') ? payload() : {})),
    )
    const { data } = await loadLive(place)
    localStorage.setItem(
      'airwise:cache:28.61,77.21',
      JSON.stringify({ ...data, fetchedAt: Date.now() - 2 * CACHE_TTL_MS }),
    )
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const r = await loadLive(place)
    expect(r.fromCache).toBe(true)
    expect(readCache(place)?.fresh).toBe(false)
  })

  it.each([
    ['unreadable JSON', '{bad'],
    ['null', 'null'],
    ['an array', '[]'],
    ['a string', '"x"'],
  ])('ignores a cache entry that is %s', (_, raw) => {
    localStorage.setItem(CACHE_KEY, raw)
    expect(readCache(place)).toBeNull()
  })

  it('accepts a well-formed cache entry and rejects every corrupted variant of it', () => {
    const good = parseAirQuality(payload(), { temperature: 10, humidity: 50, windSpeed: 3 }, 0)
    localStorage.setItem(CACHE_KEY, JSON.stringify(good))
    expect(readCache(place)?.data.nowIndex).toBe(34)
    const bad: Record<string, unknown> = {
      'sample source': { ...good, source: 'sample' },
      'nowIndex out of range': { ...good, nowIndex: 999 },
      'fractional nowIndex': { ...good, nowIndex: 1.5 },
      'hourly shorter than times': { ...good, hourly: good.hourly.slice(0, 5) },
      'no hourly rows': { ...good, times: [], hourly: [] },
      'text pollutant value': { ...good, hourly: good.hourly.map((h, i) => (i === 3 ? { ...h, pm25: 'x' } : h)) },
      'missing pollutant key': { ...good, hourly: good.hourly.map((h, i) => (i === 3 ? { pm25: 1 } : h)) },
      'malformed timestamp': { ...good, times: good.times.map((t, i) => (i === 0 ? 'not a time' : t)) },
      'invalid fetchedAt': { ...good, fetchedAt: 'yesterday' },
      'broken weather': { ...good, weather: { temperature: 'hot' } },
    }
    for (const [name, value] of Object.entries(bad)) {
      expect(isValidAirData(value), name).toBe(false)
      localStorage.setItem(CACHE_KEY, JSON.stringify(value))
      expect(readCache(place), name).toBeNull()
    }
  })

  it('refetches instead of using a corrupt cache entry', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ source: 'live', hourly: 'oops' }))
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (u: string) => ok(u.includes('air-quality') ? payload() : {})),
    )
    const r = await loadLive(place)
    expect(r.fromCache).toBe(false)
    expect(r.data.hourly).toHaveLength(48)
  })

  it('ignores corrupt cache entries', () => {
    localStorage.setItem('airwise:cache:28.61,77.21', '{bad')
    expect(readCache(place)).toBeNull()
  })
})

describe('staleness and sample mode', () => {
  it('flags data older than 3 hours', () => {
    const d = parseAirQuality(payload(), null, 0)
    expect(isStale(d, d.observedAt + 2 * 3_600_000)).toBe(false)
    expect(isStale(d, d.observedAt + 4 * 3_600_000)).toBe(true)
  })

  it('sample data is labelled sample and has a full 72-hour window', () => {
    const d = sampleData(new Date(2026, 10, 26, 15))
    expect(d.source).toBe('sample')
    expect(d.hourly).toHaveLength(72)
    expect(d.times[d.nowIndex]).toBe('2026-11-26T15:00')
  })
})

describe('city search', () => {
  it('skips very short queries and maps results', async () => {
    const f = vi
      .fn()
      .mockResolvedValue(ok({ results: [{ name: 'Surat', latitude: 21.17, longitude: 72.83, admin1: 'Gujarat' }] }))
    vi.stubGlobal('fetch', f)
    expect(await searchPlaces('s')).toEqual([])
    expect(f).not.toHaveBeenCalled()
    expect(await searchPlaces(' Surat ')).toEqual([{ name: 'Surat', lat: 21.17, lon: 72.83, admin: 'Gujarat' }])
  })
})

describe('reverse geocoding (place name for a detected location)', () => {
  const reply = (address: unknown) => vi.fn().mockResolvedValue(ok({ address }))

  it('prefers city, then town/village, then district, and appends the state', async () => {
    vi.stubGlobal('fetch', reply({ city: 'Nagpur', state: 'Maharashtra', county: 'Nagpur Urban Taluka' }))
    expect(await reverseGeocode(21.15, 79.09)).toBe('Nagpur, Maharashtra')
    vi.stubGlobal('fetch', reply({ state_district: 'Surat', state: 'Gujarat', county: 'Majura Taluka' }))
    expect(await reverseGeocode(21.17, 72.83)).toBe('Surat, Gujarat')
    vi.stubGlobal('fetch', reply({ village: 'Khoj', state: 'Khoj' }))
    expect(await reverseGeocode(1, 1)).toBe('Khoj')
  })

  it('sends rounded coordinates and identifies the app by origin only', async () => {
    const f = reply({ city: 'Pune' })
    vi.stubGlobal('fetch', f)
    await reverseGeocode(18.52, 73.86)
    const [url, init] = f.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('lat=18.52&lon=73.86')
    expect(init.referrerPolicy).toBe('origin')
  })

  it('returns null on a failed, empty, malformed or throwing response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 } as Response))
    expect(await reverseGeocode(1, 1)).toBeNull()
    vi.stubGlobal('fetch', reply({}))
    expect(await reverseGeocode(1, 1)).toBeNull()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(null)))
    expect(await reverseGeocode(1, 1)).toBeNull()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await reverseGeocode(1, 1)).toBeNull()
  })
})
