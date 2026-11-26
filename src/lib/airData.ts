import type { AirData, Place, Pollutants, Weather } from '../types'
import { computeReading } from './aqi'

const AQ_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality'
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast'
export const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search'
export const CACHE_TTL_MS = 30 * 60_000
export const STALE_AFTER_MS = 3 * 3_600_000
const CACHE_PREFIX = 'airwise:cache:'

export const isStale = (d: AirData, now = Date.now()) => now - d.observedAt > STALE_AFTER_MS

type Num = number | null
interface AqResponse {
  utc_offset_seconds: number
  current: { time: string }
  hourly: { time: string[] } & Record<'pm2_5' | 'pm10' | 'nitrogen_dioxide' | 'ozone' | 'sulphur_dioxide' | 'carbon_monoxide', Num[]>
}

const num = (v: unknown): Num => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Turns an Open-Meteo air-quality payload into AirData. Throws on an unusable payload. */
export function parseAirQuality(json: unknown, weather: Weather | null, now = Date.now()): AirData {
  const r = json as Partial<AqResponse> | null
  const h = r?.hourly
  if (!r || !h || !Array.isArray(h.time) || h.time.length === 0 || typeof r.current?.time !== 'string') {
    throw new Error('Unexpected response from the air-quality service.')
  }
  const hourly: Pollutants[] = h.time.map((_, i) => ({
    pm25: num(h.pm2_5?.[i]), pm10: num(h.pm10?.[i]), no2: num(h.nitrogen_dioxide?.[i]),
    o3: num(h.ozone?.[i]), so2: num(h.sulphur_dioxide?.[i]), co: num(h.carbon_monoxide?.[i]),
  }))
  const hourKey = r.current.time.slice(0, 13)
  const nowIndex = h.time.findIndex((t) => t.startsWith(hourKey))
  if (nowIndex < 0) throw new Error('Current hour missing from the air-quality response.')
  const observedAt = Date.parse(`${r.current.time}:00Z`) - (r.utc_offset_seconds ?? 0) * 1000
  return { source: 'live', observedAt: Number.isFinite(observedAt) ? observedAt : now, fetchedAt: now, times: h.time, hourly, nowIndex, weather }
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Service responded with status ${res.status}.`)
  return res.json()
}

async function fetchWeather(place: Place, signal?: AbortSignal): Promise<Weather | null> {
  try {
    const j = (await getJson(`${WEATHER_URL}?latitude=${place.lat}&longitude=${place.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&timezone=auto`, signal)) as {
      current?: Record<string, unknown>
    }
    const c = j.current
    const t = num(c?.temperature_2m), hum = num(c?.relative_humidity_2m), w = num(c?.wind_speed_10m)
    return t === null || hum === null || w === null ? null : { temperature: t, humidity: hum, windSpeed: w }
  } catch {
    return null
  }
}

const cacheKey = (p: Place) => `${CACHE_PREFIX}${p.lat.toFixed(2)},${p.lon.toFixed(2)}`

export function readCache(place: Place, now = Date.now()): { data: AirData; fresh: boolean } | null {
  try {
    const raw = localStorage.getItem(cacheKey(place))
    if (!raw) return null
    const data = JSON.parse(raw) as AirData
    if (data.source !== 'live' || !Array.isArray(data.hourly)) return null
    return { data, fresh: now - data.fetchedAt < CACHE_TTL_MS }
  } catch {
    return null
  }
}

/** Fetches live data, using a short-lived cache and falling back to older cached data on failure. */
export async function loadLive(place: Place, signal?: AbortSignal): Promise<{ data: AirData; fromCache: boolean }> {
  const cached = readCache(place)
  if (cached?.fresh) return { data: cached.data, fromCache: true }
  const params = 'current=pm10&hourly=pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide&past_days=1&forecast_days=2&timezone=auto'
  try {
    const [aq, weather] = await Promise.all([
      getJson(`${AQ_URL}?latitude=${place.lat}&longitude=${place.lon}&${params}`, signal),
      fetchWeather(place, signal),
    ])
    const data = parseAirQuality(aq, weather)
    try { localStorage.setItem(cacheKey(place), JSON.stringify(data)) } catch { /* storage full or blocked */ }
    return { data, fromCache: false }
  } catch (e) {
    if (signal?.aborted) throw e
    if (cached) return { data: cached.data, fromCache: true }
    throw e instanceof Error ? e : new Error('Could not load air-quality data.')
  }
}

/** Typical winter-smog day shape (PM2.5 µg/m³ per hour). Used only for the clearly labelled sample mode. */
const SAMPLE_PM25 = [168, 175, 182, 190, 196, 188, 172, 150, 128, 108, 92, 80, 72, 68, 70, 78, 94, 118, 146, 172, 184, 188, 182, 174]

export function sampleData(now = new Date()): AirData {
  const pad = (n: number) => String(n).padStart(2, '0')
  const day = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const times: string[] = []
  const hourly: Pollutants[] = []
  for (let offset = -1; offset <= 1; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
    for (let hr = 0; hr < 24; hr++) {
      times.push(`${day(d)}T${pad(hr)}:00`)
      const pm25 = SAMPLE_PM25[hr] as number
      hourly.push({ pm25, pm10: Math.round(pm25 * 1.7), no2: Math.round(pm25 * 0.35), o3: 38, so2: 14, co: Math.round(pm25 * 8) })
    }
  }
  const t = now.getTime()
  return {
    source: 'sample', observedAt: t, fetchedAt: t, times, hourly,
    nowIndex: 24 + now.getHours(), weather: { temperature: 11, humidity: 62, windSpeed: 4 },
  }
}

export const readingAt = (d: AirData, i: number) => computeReading(d.hourly[i] as Pollutants)

/** Current reading: PM values use the trailing 24 h mean (CPCB averaging), gases use the current hour. */
export function currentReading(d: AirData) {
  const now = d.hourly[d.nowIndex] as Pollutants
  const window = d.hourly.slice(Math.max(0, d.nowIndex - 23), d.nowIndex + 1)
  const mean = (key: 'pm25' | 'pm10'): Num => {
    const vals = window.map((p) => p[key]).filter((v): v is number => v !== null)
    return vals.length >= 12 ? vals.reduce((a, b) => a + b, 0) / vals.length : now[key]
  }
  return computeReading({ ...now, pm25: mean('pm25'), pm10: mean('pm10') })
}

export interface GeoResult { name: string; lat: number; lon: number; admin: string }

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<GeoResult[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const j = (await getJson(`${GEOCODE_URL}?name=${encodeURIComponent(q)}&count=6&language=en&countryCode=IN`, signal)) as {
    results?: { name: string; latitude: number; longitude: number; admin1?: string }[]
  }
  return (j.results ?? []).map((r) => ({ name: r.name, lat: r.latitude, lon: r.longitude, admin: r.admin1 ?? '' }))
}
