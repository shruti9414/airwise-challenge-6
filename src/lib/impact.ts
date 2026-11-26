import type { Saved, Trip, TripMode } from '../types'

/** Assumed kg CO₂e per passenger-km. A petrol car is the baseline each logged trip replaces. */
export const CAR_FACTOR = 0.15
export const MODE_FACTOR: Record<TripMode, number> = { walk: 0, cycle: 0, publicTransport: 0.05, carpool: 0.075, combined: 0 }
export const MODE_LABEL: Record<TripMode, string> = {
  walk: 'Walk', cycle: 'Cycle', publicTransport: 'Public transport', carpool: 'Carpool (2 people)', combined: 'Errands combined (trip saved)',
}
export const POINTS = { trip: 10, habit: 5, cap: 100 }

/** Own-property check: inherited keys such as "toString" or "__proto__" are not valid modes. */
export const isTripMode = (v: unknown): v is TripMode => typeof v === 'string' && Object.hasOwn(MODE_FACTOR, v)

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const lastDays = (n: number, from = new Date()) =>
  Array.from({ length: n }, (_, i) => dayKey(new Date(from.getFullYear(), from.getMonth(), from.getDate() - (n - 1 - i))))

export const kgAvoided = (t: Pick<Trip, 'mode' | 'km'>) => Math.max(0, t.km * (CAR_FACTOR - MODE_FACTOR[t.mode]))

export interface Impact {
  trips: number
  km: number
  co2Kg: number
  habits: number
  /** Habits that reduce personal exposure (indoor air and exposure choices). */
  exposureHabits: number
  score: number
  daily: { date: string; points: number }[]
}

export function weeklyImpact(saved: Pick<Saved, 'trips' | 'done'>, from = new Date()): Impact {
  const days = lastDays(7, from)
  const trips = saved.trips.filter((t) => days.includes(t.date))
  const doneIds = days.flatMap((d) => saved.done[d] ?? [])
  const daily = days.map((date) => ({
    date,
    points: trips.filter((t) => t.date === date).length * POINTS.trip + (saved.done[date]?.length ?? 0) * POINTS.habit,
  }))
  const raw = trips.length * POINTS.trip + doneIds.length * POINTS.habit
  return {
    trips: trips.length,
    km: round1(trips.reduce((s, t) => s + t.km, 0)),
    co2Kg: round1(trips.reduce((s, t) => s + kgAvoided(t), 0)),
    habits: doneIds.length,
    exposureHabits: doneIds.filter((id) => !id.startsWith('movement:')).length,
    score: Math.min(POINTS.cap, raw),
    daily,
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** Validates a trip form entry; returns an error message or the cleaned trip fields. */
export function validateTrip(mode: string, kmText: string): { error: string } | { mode: TripMode; km: number } {
  if (!isTripMode(mode)) return { error: 'Choose how you travelled.' }
  const km = Number(kmText)
  if (kmText.trim() === '' || !Number.isFinite(km)) return { error: 'Enter the distance in kilometres.' }
  if (km <= 0 || km > 200) return { error: 'Distance must be between 0.1 and 200 km.' }
  return { mode, km: round1(Math.max(km, 0.1)) }
}
