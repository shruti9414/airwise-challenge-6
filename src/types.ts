export type Pollutant = 'pm25' | 'pm10' | 'no2' | 'o3' | 'so2' | 'co'
/** Concentrations in µg/m³ (CO included, converted to mg/m³ only inside the AQI calculation). */
export type Pollutants = Record<Pollutant, number | null>

export type BandId = 'good' | 'satisfactory' | 'moderate' | 'poor' | 'veryPoor' | 'severe'
export type Period = 'morning' | 'afternoon' | 'evening' | 'night'
export type Guidance = 'normal' | 'reduce' | 'avoid' | 'stayIn'

export interface Weather {
  temperature: number
  humidity: number
  windSpeed: number
}

export interface AirData {
  source: 'live' | 'sample'
  /** Observation time as epoch ms (UTC). */
  observedAt: number
  fetchedAt: number
  /** Local ISO-like timestamps ("2026-11-26T14:00") for every hourly row. */
  times: string[]
  hourly: Pollutants[]
  /** Index of the current hour in `times`. */
  nowIndex: number
  weather: Weather | null
}

export interface Reading {
  aqi: number | null
  band: BandId | null
  dominant: Pollutant | null
  pollutants: Pollutants
}

export interface Place {
  name: string
  lat: number
  lon: number
  kind: 'city' | 'geo'
}

export type Activity = 'minimal' | 'walking' | 'exercise' | 'outdoorWork'
export type Commute = 'car' | 'twoWheeler' | 'publicTransport' | 'walkCycle' | 'remote'
export type Ventilation = 'openable' | 'limited' | 'acOnly'

export interface Profile {
  familySize: number
  children: boolean
  elderly: boolean
  respiratory: boolean
  activity: Activity
  commute: Commute
  ventilation: Ventilation
  purifier: boolean
}

export type TripMode = 'walk' | 'cycle' | 'publicTransport' | 'carpool' | 'combined'
export interface Trip {
  id: string
  date: string
  mode: TripMode
  km: number
}

export interface Advice {
  analysis: string
  meaning: string
  doNow: string[]
  avoid: string[]
  alternatives: string[]
  why: string
}

export interface RoutineItem {
  /** `kind:key`, kind is one of exposure | indoor | movement. */
  id: string
  text: string
  reason: string
}
export type Routine = Record<Period, RoutineItem[]>

export interface Alert {
  id: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  detail: string
}

export interface Saved {
  place: Place
  profile: Profile
  useSample: boolean
  /** date -> completed routine/indoor item ids */
  done: Record<string, string[]>
  trips: Trip[]
  joined: string[]
  checklist: string[]
}
