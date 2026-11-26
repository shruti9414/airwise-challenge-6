import type { BandId, Guidance, Pollutant, Pollutants, Reading } from '../types'

export interface Band {
  id: BandId
  label: string
  /** Upper bound of the Indian AQI (CPCB) category. */
  max: number
  health: string
}

/** CPCB National Air Quality Index categories and associated health statements. */
export const BANDS: Band[] = [
  { id: 'good', label: 'Good', max: 50, health: 'Minimal impact.' },
  {
    id: 'satisfactory',
    label: 'Satisfactory',
    max: 100,
    health: 'May cause minor breathing discomfort to sensitive people.',
  },
  {
    id: 'moderate',
    label: 'Moderate',
    max: 200,
    health:
      'May cause breathing discomfort to people with lung disease, asthma or heart disease, and to children and older adults.',
  },
  {
    id: 'poor',
    label: 'Poor',
    max: 300,
    health: 'May cause breathing discomfort to most people on prolonged exposure.',
  },
  { id: 'veryPoor', label: 'Very Poor', max: 400, health: 'May cause respiratory illness on prolonged exposure.' },
  {
    id: 'severe',
    label: 'Severe',
    max: 500,
    health: 'Affects healthy people and seriously impacts those with existing conditions.',
  },
]

export const POLLUTANT_LABEL: Record<Pollutant, string> = {
  pm25: 'PM2.5',
  pm10: 'PM10',
  no2: 'NO₂',
  o3: 'O₃',
  so2: 'SO₂',
  co: 'CO',
}
export const POLLUTANT_UNIT: Record<Pollutant, string> = {
  pm25: 'µg/m³',
  pm10: 'µg/m³',
  no2: 'µg/m³',
  o3: 'µg/m³',
  so2: 'µg/m³',
  co: 'mg/m³',
}

/** Upper concentration bound of each CPCB band (CO in mg/m³, others µg/m³); last value is a cap. */
const BREAKPOINTS: Record<Pollutant, number[]> = {
  pm25: [30, 60, 90, 120, 250, 380],
  pm10: [50, 100, 250, 350, 430, 550],
  no2: [40, 80, 180, 280, 400, 520],
  o3: [50, 100, 168, 208, 748, 900],
  so2: [40, 80, 380, 800, 1600, 2100],
  co: [1, 2, 10, 17, 34, 50],
}
const INDEX_LOW = [0, 51, 101, 201, 301, 401]

export const WHO_PM25_24H = 15

/** Concentration in the units used by the AQI tables (CO is µg/m³ in the data, mg/m³ in the table). */
export const toDisplayUnit = (p: Pollutant, v: number) => (p === 'co' ? v / 1000 : v)

export function subIndex(p: Pollutant, conc: number | null): number | null {
  if (conc === null || !Number.isFinite(conc) || conc < 0) return null
  const c = toDisplayUnit(p, conc)
  const bounds = BREAKPOINTS[p]
  const i = bounds.findIndex((b) => c <= b)
  const band = i === -1 ? bounds.length - 1 : i
  const cLo = band === 0 ? 0 : (bounds[band - 1] as number)
  const cHi = bounds[band] as number
  const iLo = INDEX_LOW[band] as number
  const iHi = (BANDS[band] as Band).max
  const clamped = Math.min(c, cHi)
  return Math.round(iLo + ((clamped - cLo) / (cHi - cLo)) * (iHi - iLo))
}

export const bandFor = (aqi: number | null): Band | null =>
  aqi === null || !Number.isFinite(aqi) || aqi < 0 ? null : (BANDS.find((b) => aqi <= b.max) ?? (BANDS[5] as Band))

export const AQI_NOTE =
  'CPCB breakpoint-based AQI estimate using modelled air-quality data. Not an official CPCB station reading.'

/** CPCB averaging periods in hours: 24 h for PM2.5, PM10, NO₂, SO₂; 8 h for CO and O₃. */
export const AVERAGING_HOURS: Record<Pollutant, number> = { pm25: 24, pm10: 24, no2: 24, so2: 24, co: 8, o3: 8 }
export const MIN_SUB_INDICES = 3

/**
 * Trailing mean of each pollutant over its CPCB averaging period ending at index `end`.
 * A pollutant needs at least two thirds of the window as valid hours (16 of 24, 6 of 8), otherwise it is null.
 */
export function averagedPollutants(hourly: Pollutants[], end: number): Pollutants {
  const out = {} as Pollutants
  for (const p of Object.keys(AVERAGING_HOURS) as Pollutant[]) {
    const hours = AVERAGING_HOURS[p]
    const vals = hourly
      .slice(Math.max(0, end - hours + 1), end + 1)
      .map((h) => h[p])
      .filter((v): v is number => v !== null && Number.isFinite(v))
    out[p] = vals.length >= Math.ceil((hours * 2) / 3) ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }
  return out
}

/** CPCB rule: the AQI is the worst sub-index; it needs at least 3 sub-indices, including PM2.5 or PM10. */
export function computeReading(pollutants: Pollutants): Reading {
  const subs = (Object.keys(pollutants) as Pollutant[])
    .map((p) => ({ p, v: subIndex(p, pollutants[p]) }))
    .filter((s): s is { p: Pollutant; v: number } => s.v !== null)
  const hasPm = subs.some((s) => s.p === 'pm25' || s.p === 'pm10')
  if (!hasPm || subs.length < MIN_SUB_INDICES) return { aqi: null, band: null, dominant: null, pollutants }
  const worst = subs.reduce((a, b) => (b.v > a.v ? b : a))
  return { aqi: worst.v, band: bandFor(worst.v)?.id ?? null, dominant: worst.p, pollutants }
}

const GUIDANCE_ORDER: Guidance[] = ['normal', 'reduce', 'avoid', 'stayIn']

const GUIDANCE_STEPS = {
  general: [0, 0, 0, 1, 2, 3],
  sensitive: [0, 0, 1, 2, 3, 3],
}

/** Outdoor-activity guidance per band; households with children, elders or respiratory conditions step stricter. */
export function guidanceFor(band: BandId | null, sensitive: boolean): Guidance {
  if (band === null) return 'reduce'
  const idx = BANDS.findIndex((b) => b.id === band)
  return GUIDANCE_ORDER[GUIDANCE_STEPS[sensitive ? 'sensitive' : 'general'][idx] as number] as Guidance
}

export const GUIDANCE_LABEL: Record<Guidance, string> = {
  normal: 'Normal outdoor activity',
  reduce: 'Limit prolonged outdoor exertion',
  avoid: 'Avoid prolonged or heavy outdoor exertion',
  stayIn: 'Stay indoors where possible',
}
