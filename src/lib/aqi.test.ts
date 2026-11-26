import { describe, expect, it } from 'vitest'
import { averagedPollutants, bandFor, computeReading, guidanceFor, subIndex } from './aqi'

import type { Pollutants } from '../types'

const none: Pollutants = { pm25: null, pm10: null, no2: null, o3: null, so2: null, co: null }

describe('AQI classification (CPCB)', () => {
  it('maps boundaries to the right category', () => {
    expect(bandFor(0)?.id).toBe('good')
    expect(bandFor(50)?.id).toBe('good')
    expect(bandFor(51)?.id).toBe('satisfactory')
    expect(bandFor(200)?.id).toBe('moderate')
    expect(bandFor(201)?.id).toBe('poor')
    expect(bandFor(300)?.id).toBe('poor')
    expect(bandFor(301)?.id).toBe('veryPoor')
    expect(bandFor(401)?.id).toBe('severe')
    expect(bandFor(900)?.id).toBe('severe')
    for (const [aqi, id] of [[100, 'satisfactory'], [101, 'moderate'], [400, 'veryPoor'], [500, 'severe']] as const) expect(bandFor(aqi)?.id).toBe(id)
  })

  it('returns null for missing or invalid values', () => {
    expect(bandFor(null)).toBeNull()
    expect(bandFor(NaN)).toBeNull()
    expect(bandFor(-5)).toBeNull()
    expect(subIndex('pm25', null)).toBeNull()
    expect(subIndex('pm25', -1)).toBeNull()
  })

  it('interpolates PM2.5 sub-index on CPCB breakpoints', () => {
    expect(subIndex('pm25', 30)).toBe(50)
    expect(subIndex('pm25', 60)).toBe(100)
    expect(subIndex('pm25', 90)).toBe(200)
    expect(subIndex('pm25', 105)).toBe(251)
    expect(subIndex('pm25', 1000)).toBe(500)
  })

  it('converts CO from µg/m³ to mg/m³ before indexing', () => {
    expect(subIndex('co', 1000)).toBe(50)
  })

  it('uses the worst pollutant and reports it as dominant', () => {
    const r = computeReading({ ...none, pm25: 20, pm10: 60, no2: 200 })
    expect(r.dominant).toBe('no2')
    expect(r.band).toBe('poor')
  })

  it('gives no AQI without any particulate reading', () => {
    const r = computeReading({ ...none, no2: 50, o3: 20 })
    expect(r).toMatchObject({ aqi: null, band: null, dominant: null })
  })
})

const full = (o: Partial<typeof none> = {}) => ({ pm25: 40, pm10: 80, no2: 30, o3: 40, so2: 10, co: 500, ...o })
const series = (n: number, f: (i: number) => Partial<typeof none>) => Array.from({ length: n }, (_, i) => ({ ...none, ...f(i) }))

describe('CPCB averaging periods', () => {
  it('uses a trailing 24-hour mean for PM2.5, PM10, NO₂ and SO₂', () => {
    const a = averagedPollutants(series(30, (i) => ({ pm25: i, pm10: i, no2: i, so2: i })), 29)
    for (const p of ['pm25', 'pm10', 'no2', 'so2'] as const) expect(a[p]).toBeCloseTo(17.5)
    expect(averagedPollutants(series(24, (i) => ({ pm25: i })), 23).pm25).toBeCloseTo(11.5)
  })

  it('uses a trailing 8-hour mean for CO and O₃', () => {
    const a = averagedPollutants(series(24, (i) => ({ pm25: i, co: i, o3: i })), 23)
    expect(a.co).toBeCloseTo(19.5)
    expect(a.o3).toBeCloseTo(19.5)
    expect(a.pm25).toBeCloseTo(11.5)
  })

  it('needs 16 valid hours of 24 and 6 valid hours of 8, otherwise the pollutant is missing', () => {
    expect(averagedPollutants(series(24, (i) => ({ pm25: i < 15 ? 10 : null })), 23).pm25).toBeNull()
    expect(averagedPollutants(series(24, (i) => ({ pm25: i < 16 ? 10 : null })), 23).pm25).toBe(10)
    expect(averagedPollutants(series(24, (i) => ({ co: i >= 19 ? 500 : null })), 23).co).toBeNull()
    expect(averagedPollutants(series(24, (i) => ({ co: i >= 18 ? 500 : null })), 23).co).toBe(500)
  })

  it('ignores non-finite values and leaves missing pollutants null', () => {
    const a = averagedPollutants(series(24, () => ({ pm25: 20, pm10: NaN })), 23)
    expect(a).toMatchObject({ pm25: 20, pm10: null, no2: null, o3: null, so2: null, co: null })
  })

  it('has too little history at the start of a series', () => {
    expect(averagedPollutants(series(24, () => ({ pm25: 20 })), 10).pm25).toBeNull()
    expect(averagedPollutants(series(24, () => ({ pm25: 20 })), 15).pm25).toBe(20)
  })
})

describe('CPCB data sufficiency for the overall AQI', () => {
  it('needs at least three valid sub-indices', () => {
    expect(computeReading({ ...none, pm25: 40 }).aqi).toBeNull()
    expect(computeReading({ ...none, pm25: 40, pm10: 80 }).aqi).toBeNull()
    expect(computeReading({ ...none, pm25: 40, pm10: 80, no2: 30 }).aqi).not.toBeNull()
  })

  it('needs PM2.5 or PM10 even when every gas is present', () => {
    expect(computeReading(full({ pm25: null, pm10: null }))).toMatchObject({ aqi: null, band: null, dominant: null })
    expect(computeReading(full({ pm25: null })).aqi).not.toBeNull()
    expect(computeReading(full({ pm10: null })).aqi).not.toBeNull()
  })

  it('maps PM10 breakpoints to category boundaries', () => {
    for (const [c, idx] of [[50, 50], [100, 100], [250, 200], [350, 300], [430, 400]] as const) expect(subIndex('pm10', c)).toBe(idx)
  })
})

describe('outdoor guidance', () => {
  it('steps stricter for sensitive households', () => {
    expect(guidanceFor('good', true)).toBe('normal')
    expect(guidanceFor('moderate', false)).toBe('normal')
    expect(guidanceFor('moderate', true)).toBe('reduce')
    expect(guidanceFor('poor', false)).toBe('reduce')
    expect(guidanceFor('poor', true)).toBe('avoid')
    expect(guidanceFor('severe', false)).toBe('stayIn')
  })
  it('is cautious when the band is unknown', () => {
    expect(guidanceFor(null, false)).toBe('reduce')
  })
})
