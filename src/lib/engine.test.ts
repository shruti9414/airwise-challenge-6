import { describe, expect, it } from 'vitest'
import { flatData, profile } from '../testData'
import { assess, buildAdvice, buildAlerts, buildRoutine } from './engine'
import { bestWindow, periodOutlook } from './outlook'
import { alternativesFor, rankHacks } from './content'
import { sampleData } from './airData'

const ctx = (pm25: number, p = {}) => assess(flatData(pm25), profile(p))
const text = (pm25: number, p = {}) => JSON.stringify(buildAdvice(ctx(pm25, p)))

describe('recommendation engine', () => {
  it('scenario 1: good AQI + children → normal outdoor activity', () => {
    const a = buildAdvice(ctx(10, { children: true }))
    expect(a.doNow[0]).toMatch(/Normal outdoor activity is fine/)
    expect(a.doNow[0]).toMatch(/children/)
  })

  it('scenario 2: poor AQI + children → reduce prolonged exertion, indoor alternatives', () => {
    const a = buildAdvice(ctx(105, { children: true }))
    expect(a.doNow[0]).toMatch(/indoors/)
    expect(a.avoid.join(' ')).toMatch(/children/)
    expect(a.alternatives.join(' ')).toMatch(/indoor/i)
  })

  it('scenario 3: severe AQI + elderly → avoid exertion, follow advisories, seek medical advice', () => {
    const a = buildAdvice(ctx(300, { elderly: true }))
    const all = a.doNow.join(' ')
    expect(all).toMatch(/essential/)
    expect(all).toMatch(/official local advisories/)
    expect(all).toMatch(/medical advice/)
    expect(all).toMatch(/older family members/)
  })

  it('scenario 4: high PM2.5 without purifier → reduce indoor sources, keep windows closed', () => {
    const a = buildAdvice(ctx(100))
    expect(a.doNow.join(' ')).toMatch(/Reduce indoor sources/)
    expect(a.doNow.join(' ')).toMatch(/windows closed/)
    expect(buildAdvice(ctx(100, { purifier: true })).doNow.join(' ')).toMatch(/purifier in the room/)
  })

  it('scenario 5: car commuters get public transport / carpool suggestions', () => {
    expect(buildAdvice(ctx(100, { commute: 'car' })).alternatives.join(' ')).toMatch(/public transport/)
    expect(buildAdvice(ctx(300, { commute: 'walkCycle' })).alternatives.join(' ')).toMatch(
      /instead of walking or cycling/,
    )
  })

  it('produces different advice for different profiles and AQI levels', () => {
    const outputs = new Set([
      text(10),
      text(105),
      text(300),
      text(105, { elderly: true }),
      text(105, { commute: 'remote' }),
    ])
    expect(outputs.size).toBe(5)
  })

  it('handles missing particulate data with a clear fallback', () => {
    const data = flatData(50)
    data.hourly = data.hourly.map((h) => ({ ...h, pm25: null, pm10: null }))
    const a = buildAdvice(assess(data, profile()))
    expect(a.analysis).toMatch(/unavailable/)
    expect(a.meaning).toMatch(/uncertain/)
  })

  it('never recommends walking or cycling as a good choice in severe conditions', () => {
    const a = buildAdvice(ctx(300, { activity: 'exercise', commute: 'walkCycle' }))
    expect(JSON.stringify(a)).not.toMatch(/great low-emission choice/)
  })
})

describe('daily routine', () => {
  it('has all four periods with a reason on every item', () => {
    const r = buildRoutine(ctx(60))
    for (const items of Object.values(r)) {
      expect(items.length).toBeGreaterThan(0)
      items.forEach((i) => {
        expect(i.reason.length).toBeGreaterThan(5)
        expect(i.id).toMatch(/^(exposure|indoor|movement):/)
      })
    }
  })

  it('adds a mask suggestion only for very poor air and skips commute items when remote', () => {
    const ids = (pm: number, p = {}) =>
      Object.values(buildRoutine(ctx(pm, p)))
        .flat()
        .map((i) => i.id)
    expect(ids(200)).toContain('exposure:morning-mask')
    expect(ids(20)).not.toContain('exposure:morning-mask')
    expect(ids(200, { commute: 'remote' })).not.toContain('movement:morning-commute')
  })

  it('finds a best outdoor window and period outlooks from the sample day', () => {
    const d = sampleData(new Date(2026, 10, 26, 9))
    const w = bestWindow(d)
    expect(w).not.toBeNull()
    expect(w!.start).toBeGreaterThanOrEqual(12)
    expect(w!.start).toBeLessThanOrEqual(14)
    expect(periodOutlook(d, 'afternoon')!.aqi).toBeLessThan(periodOutlook(d, 'morning')!.aqi)
  })
})

describe('alerts', () => {
  it('flags severe air, high PM2.5 and sample data', () => {
    const ids = buildAlerts(ctx(300)).map((a) => a.id)
    expect(ids).toEqual(expect.arrayContaining(['band', 'pm25']))
    const sample = buildAlerts({ ...ctx(10), data: sampleData() }).map((a) => a.id)
    expect(sample).toContain('sample')
  })

  it('stays quiet for clean air', () => {
    const data = { ...flatData(10), source: 'live' as const }
    expect(buildAlerts({ ...ctx(10), data, now: data.observedAt })).toEqual([])
  })

  it('warns about stale data', () => {
    const c = ctx(10)
    expect(buildAlerts({ ...c, now: c.data.observedAt + 4 * 3_600_000 }).map((a) => a.id)).toContain('stale')
  })

  it('announces an upcoming change in outdoor guidance', () => {
    const c = assess(sampleData(new Date(2026, 10, 26, 7)), profile())
    expect(buildAlerts(c).some((a) => a.id === 'change')).toBe(true)
  })
})

describe('indoor hacks and sustainable alternatives', () => {
  it('ranks purifier first when PM is high and none is owned, and plants last', () => {
    const r = rankHacks({ pmHigh: true, purifier: false, severe: false, openable: true })
    expect(r[0]!.id).toBe('indoor:hack-hepa')
    expect(r[r.length - 1]!.id).toBe('indoor:hack-plants')
  })

  it('deprioritises ventilation when air is severe', () => {
    const r = rankHacks({ pmHigh: true, purifier: true, severe: true, openable: true })
    expect(r.findIndex((h) => h.id === 'indoor:hack-ventilate')).toBeGreaterThan(5)
  })

  it('makes no unsupported plant claims', () => {
    const plants = rankHacks({ pmHigh: false, purifier: false, severe: false, openable: false }).find(
      (h) => h.id === 'indoor:hack-plants',
    )!
    expect(plants.benefit).toMatch(/not measurable/)
  })

  it('pauses walking/cycling in poor air and personalises by commute', () => {
    const bad = alternativesFor(profile({ commute: 'car' }), true)
    expect(bad.paused).toMatch(/paused/)
    expect(bad.items.some((a) => a.id === 'walk')).toBe(false)
    expect(bad.items.some((a) => a.id === 'carpool')).toBe(true)
    const ok = alternativesFor(profile({ commute: 'walkCycle' }), false)
    expect(ok.paused).toBeNull()
    expect(ok.items.some((a) => a.id === 'walk')).toBe(true)
    expect(ok.items.some((a) => a.id === 'carpool')).toBe(false)
  })
})
