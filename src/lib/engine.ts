import type { AirData, BandId, Profile, Reading } from '../types'
import { BANDS } from './aqi'
import { currentReading } from './airData'

export interface Context {
  data: AirData
  reading: Reading
  profile: Profile
  now?: number
}

export const isSensitive = (p: Profile) => p.children || p.elderly || p.respiratory
export const bandIndex = (b: BandId | null) => (b === null ? 2 : BANDS.findIndex((x) => x.id === b))
export const label = (b: BandId | null) => BANDS[bandIndex(b)]?.label ?? 'Unknown'
export const add = (list: string[], cond: unknown, text: string) => {
  if (cond) list.push(text)
}

export const assess = (data: AirData, profile: Profile): Context => ({ data, reading: currentReading(data), profile })
