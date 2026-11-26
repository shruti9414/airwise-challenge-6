import { describe, expect, it } from 'vitest'
import { bandFor, computeReading, guidanceFor, subIndex } from './aqi'

const none = { pm25: null, pm10: null, no2: null, o3: null, so2: null, co: null }

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
