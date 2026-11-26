import type { AirData, BandId, Profile, Reading } from '../types'
import { BANDS } from './aqi'
import { currentReading } from './airData'

export interface Context {
  data: AirData
  reading: Reading
  profile: Profile
  now?: number
}

/** Band indexes used by the rules: Moderate = 2, Poor = 3 (Good = 0 .. Severe = 5). */
export const BAND_LEVEL = { moderate: 2, poor: 3 }

export const isSensitive = (p: Profile) => p.children || p.elderly || p.respiratory
export const bandIndex = (b: BandId | null) => (b === null ? BAND_LEVEL.moderate : BANDS.findIndex((x) => x.id === b))
export const label = (b: BandId | null) => BANDS[bandIndex(b)]?.label ?? 'Unknown'

export const assess = (data: AirData, profile: Profile): Context => ({ data, reading: currentReading(data), profile })
