import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CACHE_TTL_MS, currentReading, isStale, loadLive, parseAirQuality, readCache, sampleData, searchPlaces } from './airData'
import type { Place } from '../types'

const place: Place = { name: 'Delhi', lat: 28.61, lon: 77.21, kind: 'city' }
const hours = (n: number) => Array.from({ length: n }, (_, i) => `2026-11-26T${String(i % 24).padStart(2, '0')}:00`)
const payload = (pm25 = 120) => ({
  utc_offset_seconds: 19800,
  current: { time: '2026-11-26T10:00' },
  hourly: {
    time: hours(24), pm2_5: Array(24).fill(pm25), pm10: Array(24).fill(200), nitrogen_dioxide: Array(24).fill(40),
    ozone: Array(24).fill(30), sulphur_dioxide: Array(24).fill(10), carbon_monoxide: Array(24).fill(600),
  },
})
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

describe('air data parsing', () => {
  it('parses a valid response and locates the current hour', () => {
    const d = parseAirQuality(payload(), null, 0)
    expect(d.source).toBe('live')
    expect(d.nowIndex).toBe(10)
    expect(d.observedAt).toBe(Date.UTC(2026, 10, 26, 10, 0) - 19800 * 1000)
    expect(currentReading(d).band).toBe('poor')
  })

  it('rejects malformed payloads', () => {
    expect(() => parseAirQuality({}, null)).toThrow()
    expect(() => parseAirQuality({ ...payload(), current: { time: '2020-01-01T00:00' } }, null)).toThrow()
  })

  it('treats non-numeric values as missing', () => {
    const p = payload()
    ;(p.hourly.pm2_5 as unknown[])[10] = 'x'
    expect(parseAirQuality(p, null).hourly[10]!.pm25).toBeNull()
  })
})

describe('live loading, caching and errors', () => {
  it('fetches, caches, then serves from cache without another request', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) =>
      ok(url.includes('air-quality') ? payload() : { current: { temperature_2m: 10, relative_humidity_2m: 50, wind_speed_10m: 3 } }))
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
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (u: string) => ok(u.includes('air-quality') ? payload() : {})))
    const { data } = await loadLive(place)
    localStorage.setItem('airwise:cache:28.61,77.21', JSON.stringify({ ...data, fetchedAt: Date.now() - 2 * CACHE_TTL_MS }))
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const r = await loadLive(place)
    expect(r.fromCache).toBe(true)
    expect(readCache(place)?.fresh).toBe(false)
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
    const f = vi.fn().mockResolvedValue(ok({ results: [{ name: 'Surat', latitude: 21.17, longitude: 72.83, admin1: 'Gujarat' }] }))
    vi.stubGlobal('fetch', f)
    expect(await searchPlaces('s')).toEqual([])
    expect(f).not.toHaveBeenCalled()
    expect(await searchPlaces(' Surat ')).toEqual([{ name: 'Surat', lat: 21.17, lon: 72.83, admin: 'Gujarat' }])
  })
})
