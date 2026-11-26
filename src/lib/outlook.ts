import type { AirData, BandId, Period } from '../types'
import { bandFor } from './aqi'
import { outlookAt } from './airData'

export const PERIOD_IDS: Period[] = ['morning', 'afternoon', 'evening', 'night']

export const hourOf = (t: string) => Number(t.slice(11, 13))
export const fmtHour = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'am' : 'pm'}`

export const PERIODS: Record<Period, { label: string; hours: number[] }> = {
  morning: { label: 'Morning', hours: [6, 7, 8, 9, 10, 11] },
  afternoon: { label: 'Afternoon', hours: [12, 13, 14, 15, 16] },
  evening: { label: 'Evening', hours: [17, 18, 19, 20] },
  night: { label: 'Night', hours: [21, 22, 23] },
}

export function periodOf(hour: number): Period {
  if (hour >= 6 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}

export const currentHour = (d: AirData) => hourOf(d.times[d.nowIndex] ?? '00T00')

/** Hourly AQI indexes (into data.hourly) that belong to the same local day as "now". */
function todayIndexes(d: AirData): number[] {
  const day = (d.times[d.nowIndex] ?? '').slice(0, 10)
  return d.times.flatMap((t, i) => (t.startsWith(day) ? [i] : []))
}

/** Mean hourly AQI for the hours of a day period today; null when no data is available. */
export function periodOutlook(d: AirData, period: Period): { aqi: number; band: BandId } | null {
  const vals = todayIndexes(d)
    .filter((i) => PERIODS[period].hours.includes(hourOf(d.times[i] ?? '')))
    .map((i) => outlookAt(d, i).aqi)
    .filter((v): v is number => v !== null)
  if (vals.length === 0) return null
  const aqi = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  const band = bandFor(aqi)?.id
  return band ? { aqi, band } : null
}

/** Two-hour window (today, 6 am–9 pm, not already over) with the lowest forecast AQI. */
export function bestWindow(d: AirData): { start: number; end: number; aqi: number; band: BandId } | null {
  const hour = currentHour(d)
  const byHour = new Map(todayIndexes(d).map((i) => [hourOf(d.times[i] ?? ''), outlookAt(d, i).aqi]))
  let best: { start: number; aqi: number } | null = null
  for (let s = Math.max(6, hour); s <= 19; s++) {
    const a = byHour.get(s),
      b = byHour.get(s + 1)
    if (typeof a !== 'number' || typeof b !== 'number') continue
    const avg = (a + b) / 2
    if (!best || avg < best.aqi) best = { start: s, aqi: avg }
  }
  if (!best) return null
  const aqi = Math.round(best.aqi)
  const band = bandFor(aqi)?.id
  return band ? { start: best.start, end: best.start + 2, aqi, band } : null
}
