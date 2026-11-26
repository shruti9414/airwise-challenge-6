import type { AirData, Pollutants, Profile } from './types'
import { sampleData } from './lib/airData'
import { DEFAULT_PROFILE } from './lib/storage'

/** Test helper: a full day of constant PM2.5 (plus proportional PM10) at a fixed hour. */
export function flatData(pm25: number, hour = 10): AirData {
  const base = sampleData(new Date(2026, 10, 26, hour))
  const row: Pollutants = { pm25, pm10: pm25 * 1.5, no2: 20, o3: 30, so2: 8, co: 500 }
  return { ...base, hourly: base.hourly.map(() => ({ ...row })) }
}

export const profile = (p: Partial<Profile> = {}): Profile => ({ ...DEFAULT_PROFILE, ...p })
