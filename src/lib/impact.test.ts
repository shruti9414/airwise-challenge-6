import { describe, expect, it } from 'vitest'
import { CAR_FACTOR, dayKey, kgAvoided, lastDays, validateTrip, weeklyImpact } from './impact'

const NOW = new Date(2026, 10, 26)
const today = dayKey(NOW)

describe('impact calculations', () => {
  it('computes avoided emissions against the car baseline', () => {
    expect(kgAvoided({ mode: 'walk', km: 10 })).toBeCloseTo(10 * CAR_FACTOR)
    expect(kgAvoided({ mode: 'publicTransport', km: 10 })).toBeCloseTo(1)
    expect(kgAvoided({ mode: 'carpool', km: 10 })).toBeCloseTo(0.75)
  })

  it('aggregates the last 7 days only and caps the score', () => {
    const old = dayKey(new Date(2026, 10, 10))
    const w = weeklyImpact({
      trips: [{ id: '1', date: today, mode: 'walk', km: 2 }, { id: '2', date: old, mode: 'walk', km: 50 }],
      done: { [today]: ['exposure:a', 'indoor:b', 'movement:c'], [old]: ['indoor:old'] },
    }, NOW)
    expect(w).toMatchObject({ trips: 1, km: 2, co2Kg: 0.3, habits: 3, exposureHabits: 2, score: 25 })
    expect(w.daily).toHaveLength(7)
    const many = weeklyImpact({ trips: Array.from({ length: 20 }, (_, i) => ({ id: `${i}`, date: today, mode: 'walk' as const, km: 1 })), done: {} }, NOW)
    expect(many.score).toBe(100)
  })

  it('returns zeros for empty data', () => {
    expect(weeklyImpact({ trips: [], done: {} }, NOW)).toMatchObject({ trips: 0, co2Kg: 0, score: 0 })
  })

  it('lists consecutive days ending today', () => {
    const d = lastDays(3, NOW)
    expect(d[2]).toBe(today)
    expect(d).toHaveLength(3)
  })

  it('validates trip input', () => {
    expect(validateTrip('walk', '')).toHaveProperty('error')
    expect(validateTrip('walk', 'abc')).toHaveProperty('error')
    expect(validateTrip('walk', '-3')).toHaveProperty('error')
    expect(validateTrip('walk', '0')).toHaveProperty('error')
    expect(validateTrip('walk', '999')).toHaveProperty('error')
    expect(validateTrip('teleport', '3')).toHaveProperty('error')
    expect(validateTrip('cycle', '2.46')).toEqual({ mode: 'cycle', km: 2.5 })
  })
})
