import { describe, expect, it } from 'vitest'
import { compact, isRecord, roundTo } from './util'

describe('shared helpers', () => {
  it('rounds to a fixed number of decimals', () => {
    expect(roundTo(28.70412, 2)).toBe(28.7)
    expect(roundTo(2.46, 1)).toBe(2.5)
    expect(roundTo(-1.005, 0)).toBe(-1)
  })

  it('recognises plain objects only', () => {
    expect(isRecord({ a: 1 })).toBe(true)
    for (const v of [null, undefined, [], 'x', 3, true]) expect(isRecord(v)).toBe(false)
  })

  it('drops falsy entries while keeping order and narrowing the type', () => {
    const skip = false as boolean
    const items: string[] = compact(['a', false, null, undefined, 'b', skip && 'c'])
    expect(items).toEqual(['a', 'b'])
    expect(compact([])).toEqual([])
  })
})
