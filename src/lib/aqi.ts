import type { BandId, Guidance, Pollutant, Pollutants, Reading } from '../types'

export const POLLUTANTS: Pollutant[] = ['pm25', 'pm10', 'no2', 'o3', 'so2', 'co']

export interface Band {
  id: BandId
  label: string
  /** Upper bound of the Indian AQI (CPCB) category. */
  max: number
  /** Upper concentration bound of this category per pollutant (CO in mg/m³, others µg/m³). */
  limits: Record<Pollutant, number>
  health: string
}

/** CPCB National Air Quality Index categories, concentration breakpoints and health statements. */
export const BANDS: Band[] = [
  {
    id: 'good',
    label: 'Good',
    max: 50,
    limits: { pm25: 30, pm10: 50, no2: 40, o3: 50, so2: 40, co: 1 },
    health: 'Minimal impact.',
  },
  {
    id: 'satisfactory',
    label: 'Satisfactory',
    max: 100,
    limits: { pm25: 60, pm10: 100, no2: 80, o3: 100, so2: 80, co: 2 },
    health: 'May cause minor breathing discomfort to sensitive people.',
  },
  {
    id: 'moderate',
    label: 'Moderate',
    max: 200,
    limits: { pm25: 90, pm10: 250, no2: 180, o3: 168, so2: 380, co: 10 },
    health:
      'May cause breathing discomfort to people with lung disease, asthma or heart disease, and to children and older adults.',
  },
  {
    id: 'poor',
    label: 'Poor',
    max: 300,
    limits: { pm25: 120, pm10: 350, no2: 280, o3: 208, so2: 800, co: 17 },
    health: 'May cause breathing discomfort to most people on prolonged exposure.',
  },
  {
    id: 'veryPoor',
    label: 'Very Poor',
    max: 400,
    limits: { pm25: 250, pm10: 430, no2: 400, o3: 748, so2: 1600, co: 34 },
    health: 'May cause respiratory illness on prolonged exposure.',
  },
  {
    id: 'severe',
    label: 'Severe',
    max: 500,
    limits: { pm25: 380, pm10: 550, no2: 520, o3: 900, so2: 2100, co: 50 },
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

export const WHO_PM25_24H = 15
/** Indian 24-hour PM2.5 standard in µg/m³. */
export const PM25_STANDARD_24H = 60

export const NO_POLLUTANTS: Pollutants = { pm25: null, pm10: null, no2: null, o3: null, so2: null, co: null }

/** One linear-interpolation step: concentrations cLo..cHi map onto index values iLo..iHi. */
interface Segment {
  cLo: number
  cHi: number
  iLo: number
  iHi: number
}

/** Segments for a pollutant, one per band; each band's index range starts just above the previous band's maximum. */
function segmentsFor(pollutant: Pollutant): Segment[] {
  let cLo = 0
  let iLo = 0
  return BANDS.map((band) => {
    const segment = { cLo, cHi: band.limits[pollutant], iLo, iHi: band.max }
    cLo = segment.cHi
    iLo = band.max + 1
    return segment
  })
}

const SEGMENTS = new Map(POLLUTANTS.map((p) => [p, segmentsFor(p)]))

/** Concentration in the units used by the AQI tables (CO is µg/m³ in the data, mg/m³ in the table). */
export const toDisplayUnit = (p: Pollutant, v: number) => (p === 'co' ? v / 1000 : v)

export function subIndex(p: Pollutant, conc: number | null): number | null {
  if (conc === null || !Number.isFinite(conc) || conc < 0) return null
  const c = toDisplayUnit(p, conc)
  const segments = SEGMENTS.get(p) ?? []
  const seg = segments.find((s) => c <= s.cHi) ?? segments.at(-1)
  if (!seg) return null
  const clamped = Math.min(c, seg.cHi)
  return Math.round(seg.iLo + ((clamped - seg.cLo) / (seg.cHi - seg.cLo)) * (seg.iHi - seg.iLo))
}

export const bandFor = (aqi: number | null): Band | null =>
  aqi === null || !Number.isFinite(aqi) || aqi < 0 ? null : (BANDS.find((b) => aqi <= b.max) ?? BANDS.at(-1) ?? null)

export const AQI_NOTE =
  'CPCB breakpoint-based AQI estimate using modelled air-quality data. Not an official CPCB station reading.'

/** CPCB averaging periods in hours: 24 h for PM2.5, PM10, NO₂, SO₂; 8 h for CO and O₃. */
export const AVERAGING_HOURS: Record<Pollutant, number> = { pm25: 24, pm10: 24, no2: 24, so2: 24, co: 8, o3: 8 }
export const MIN_SUB_INDICES = 3

/** Trailing mean over the pollutant's averaging window ending at `end`; null with under two thirds valid hours. */
function windowMean(hourly: Pollutants[], end: number, p: Pollutant): number | null {
  const hours = AVERAGING_HOURS[p]
  const values = hourly
    .slice(Math.max(0, end - hours + 1), end + 1)
    .map((h) => h[p])
    .filter((v): v is number => v !== null && Number.isFinite(v))
  return values.length >= Math.ceil((hours * 2) / 3) ? values.reduce((a, b) => a + b, 0) / values.length : null
}

/** CPCB averaging for every pollutant at index `end` (16 valid hours of 24, or 6 of 8, otherwise missing). */
export const averagedPollutants = (hourly: Pollutants[], end: number): Pollutants => ({
  pm25: windowMean(hourly, end, 'pm25'),
  pm10: windowMean(hourly, end, 'pm10'),
  no2: windowMean(hourly, end, 'no2'),
  o3: windowMean(hourly, end, 'o3'),
  so2: windowMean(hourly, end, 'so2'),
  co: windowMean(hourly, end, 'co'),
})

/** CPCB rule: the AQI is the worst sub-index; it needs at least 3 sub-indices, including PM2.5 or PM10. */
export function computeReading(pollutants: Pollutants): Reading {
  const subs = POLLUTANTS.map((p) => ({ p, v: subIndex(p, pollutants[p]) })).filter(
    (s): s is { p: Pollutant; v: number } => s.v !== null,
  )
  const hasPm = subs.some((s) => s.p === 'pm25' || s.p === 'pm10')
  if (!hasPm || subs.length < MIN_SUB_INDICES) return { aqi: null, band: null, dominant: null, pollutants }
  const worst = subs.reduce((a, b) => (b.v > a.v ? b : a))
  return { aqi: worst.v, band: bandFor(worst.v)?.id ?? null, dominant: worst.p, pollutants }
}

/** Outdoor-activity guidance per band, from Good to Severe. Sensitive households step one level stricter. */
const GUIDANCE_BY_BAND: Record<'general' | 'sensitive', Guidance[]> = {
  general: ['normal', 'normal', 'normal', 'reduce', 'avoid', 'stayIn'],
  sensitive: ['normal', 'normal', 'reduce', 'avoid', 'stayIn', 'stayIn'],
}

export function guidanceFor(band: BandId | null, sensitive: boolean): Guidance {
  const index = BANDS.findIndex((b) => b.id === band)
  return GUIDANCE_BY_BAND[sensitive ? 'sensitive' : 'general'][index] ?? 'reduce'
}

export const GUIDANCE_LABEL: Record<Guidance, string> = {
  normal: 'Normal outdoor activity',
  reduce: 'Limit prolonged outdoor exertion',
  avoid: 'Avoid prolonged or heavy outdoor exertion',
  stayIn: 'Stay indoors where possible',
}
