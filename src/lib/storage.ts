import type { Activity, Commute, Place, Profile, Saved, Trip, Ventilation } from '../types'
import { isTripMode } from './impact'

export const STORAGE_KEY = 'airwise:v1'

export const CITIES: Place[] = [
  { name: 'Ahmedabad', lat: 23.03, lon: 72.58, kind: 'city' },
  { name: 'Delhi', lat: 28.61, lon: 77.21, kind: 'city' },
  { name: 'Mumbai', lat: 19.08, lon: 72.88, kind: 'city' },
  { name: 'Bengaluru', lat: 12.97, lon: 77.59, kind: 'city' },
  { name: 'Pune', lat: 18.52, lon: 73.86, kind: 'city' },
  { name: 'Kolkata', lat: 22.57, lon: 88.36, kind: 'city' },
  { name: 'Chennai', lat: 13.08, lon: 80.27, kind: 'city' },
  { name: 'Hyderabad', lat: 17.39, lon: 78.49, kind: 'city' },
  { name: 'Lucknow', lat: 26.85, lon: 80.95, kind: 'city' },
  { name: 'Jaipur', lat: 26.91, lon: 75.79, kind: 'city' },
]

const KM_PER_DEGREE = 111.2
const round2 = (n: number) => Math.round(n * 100) / 100

/** Nearest preset city within `maxKm`, used only to give a device location a readable name (no network call). */
export function nearestCity(lat: number, lon: number, maxKm = 60): Place | null {
  const lonScale = Math.cos((lat * Math.PI) / 180)
  let best: Place | null = null
  let bestKm = maxKm
  for (const c of CITIES) {
    const km = Math.hypot((c.lat - lat) * KM_PER_DEGREE, (c.lon - lon) * KM_PER_DEGREE * lonScale)
    if (km <= bestKm) {
      best = c
      bestKm = km
    }
  }
  return best
}

/**
 * A device-detected place: coordinates rounded to ~1 km. Named by the reverse-geocoded `area` when given,
 * otherwise by the nearest preset city, otherwise generically.
 */
export function geoPlace(lat: number, lon: number, area?: string | null): Place {
  const near = nearestCity(lat, lon)
  const name = area ? `${area} (approx.)` : near ? `Near ${near.name} (approx.)` : 'Your location (approx.)'
  return { name, lat: round2(lat), lon: round2(lon), kind: 'geo' }
}

export const DEFAULT_PROFILE: Profile = {
  familySize: 4,
  children: false,
  elderly: false,
  respiratory: false,
  activity: 'walking',
  commute: 'car',
  ventilation: 'openable',
  purifier: false,
}

export const DEFAULT_SAVED: Saved = {
  place: CITIES[1] as Place,
  profile: DEFAULT_PROFILE,
  useSample: false,
  done: {},
  trips: [],
  joined: [],
  checklist: [],
}

export const OPTIONS = {
  activity: ['minimal', 'walking', 'exercise', 'outdoorWork'] as Activity[],
  commute: ['car', 'twoWheeler', 'publicTransport', 'walkCycle', 'remote'] as Commute[],
  ventilation: ['openable', 'limited', 'acOnly'] as Ventilation[],
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const oneOf = <T extends string>(v: unknown, allowed: T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback
const strings = (v: unknown, max: number): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length <= 80).slice(0, max) : []

export function parseFamilySize(text: string): { value: number } | { error: string } {
  const n = Number(text)
  if (text.trim() === '' || !Number.isInteger(n)) return { error: 'Enter a whole number of people.' }
  if (n < 1 || n > 12) return { error: 'Family size must be between 1 and 12.' }
  return { value: n }
}

export function sanitizeProfile(v: unknown): Profile {
  const o = isObj(v) ? v : {}
  const d = DEFAULT_PROFILE
  const size = Number(o.familySize)
  return {
    familySize: Number.isInteger(size) && size >= 1 && size <= 12 ? size : d.familySize,
    children: o.children === true,
    elderly: o.elderly === true,
    respiratory: o.respiratory === true,
    purifier: o.purifier === true,
    activity: oneOf(o.activity, OPTIONS.activity, d.activity),
    commute: oneOf(o.commute, OPTIONS.commute, d.commute),
    ventilation: oneOf(o.ventilation, OPTIONS.ventilation, d.ventilation),
  }
}

function sanitizePlace(v: unknown): Place {
  const known = isObj(v) ? CITIES.find((c) => c.name === v.name) : undefined
  return (
    known ??
    (isObj(v) &&
    v.kind === 'city' &&
    typeof v.name === 'string' &&
    v.name.length <= 60 &&
    Number.isFinite(v.lat) &&
    Number.isFinite(v.lon) &&
    Math.abs(v.lat as number) <= 90 &&
    Math.abs(v.lon as number) <= 180
      ? { name: v.name, lat: Number(v.lat), lon: Number(v.lon), kind: 'city' }
      : DEFAULT_SAVED.place)
  )
}

function sanitizeTrips(v: unknown): Trip[] {
  if (!Array.isArray(v)) return []
  return v
    .flatMap((t): Trip[] =>
      isObj(t) &&
      typeof t.id === 'string' &&
      typeof t.date === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(t.date) &&
      isTripMode(t.mode) &&
      typeof t.km === 'number' &&
      t.km > 0 &&
      t.km <= 200
        ? [{ id: t.id.slice(0, 40), date: t.date, mode: t.mode, km: t.km }]
        : [],
    )
    .slice(-100)
}

function sanitizeDone(v: unknown): Record<string, string[]> {
  if (!isObj(v)) return {}
  const entries = Object.entries(v)
    .filter(([k]) => /^\d{4}-\d{2}-\d{2}$/.test(k))
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
  return Object.fromEntries(entries.map(([k, ids]) => [k, strings(ids, 40)]))
}

export function sanitizeSaved(v: unknown): Saved {
  const o = isObj(v) ? v : {}
  return {
    place: sanitizePlace(o.place),
    profile: sanitizeProfile(o.profile),
    useSample: o.useSample === true,
    done: sanitizeDone(o.done),
    trips: sanitizeTrips(o.trips),
    joined: strings(o.joined, 10),
    checklist: strings(o.checklist, 20),
  }
}

export function loadSaved(): Saved {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? sanitizeSaved(JSON.parse(raw)) : DEFAULT_SAVED
  } catch {
    return DEFAULT_SAVED
  }
}

export function persist(s: Saved): void {
  try {
    // Device-detected locations are never persisted; only named cities are.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...s, place: s.place.kind === 'geo' ? DEFAULT_SAVED.place : s.place }),
    )
  } catch {
    /* storage unavailable or full: the app keeps working in memory */
  }
}

export function clearAllSaved(): void {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('airwise:'))
      .forEach((k) => localStorage.removeItem(k))
  } catch {
    /* ignore */
  }
}
