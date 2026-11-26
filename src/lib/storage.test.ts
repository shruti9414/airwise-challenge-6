import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SAVED, STORAGE_KEY, clearAllSaved, loadSaved, parseFamilySize, persist, sanitizeProfile, sanitizeSaved } from './storage'

beforeEach(() => localStorage.clear())

describe('local storage handling', () => {
  it('returns defaults when nothing or garbage is stored', () => {
    expect(loadSaved()).toEqual(DEFAULT_SAVED)
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(loadSaved()).toEqual(DEFAULT_SAVED)
  })

  it('round-trips valid state', () => {
    const s = { ...DEFAULT_SAVED, joined: ['car-light'], trips: [{ id: 'a', date: '2026-11-26', mode: 'walk' as const, km: 2 }] }
    persist(s)
    expect(loadSaved()).toEqual(s)
  })

  it('sanitises tampered values', () => {
    const s = sanitizeSaved({
      place: { name: '<script>', lat: 999, lon: 1, kind: 'city' },
      profile: { familySize: 9999, commute: 'rocket', children: 'yes' },
      trips: [{ id: 'x', date: 'bad', mode: 'walk', km: 1 }, { id: 'y', date: '2026-11-26', mode: 'walk', km: -4 }],
      done: { 'not-a-date': ['x'], '2026-11-26': ['ok', 5] },
      joined: 'nope',
    })
    expect(s.place).toEqual(DEFAULT_SAVED.place)
    expect(s.profile.familySize).toBe(DEFAULT_SAVED.profile.familySize)
    expect(s.profile.commute).toBe(DEFAULT_SAVED.profile.commute)
    expect(s.profile.children).toBe(false)
    expect(s.trips).toEqual([])
    expect(s.done).toEqual({ '2026-11-26': ['ok'] })
    expect(s.joined).toEqual([])
  })

  it('never persists a device-detected location', () => {
    persist({ ...DEFAULT_SAVED, place: { name: 'Your location (approx.)', lat: 1.23, lon: 4.56, kind: 'geo' } })
    expect(localStorage.getItem(STORAGE_KEY)).not.toContain('1.23')
  })

  it('clears every airwise key but nothing else', () => {
    localStorage.setItem('airwise:cache:1,2', 'x')
    localStorage.setItem(STORAGE_KEY, '{}')
    localStorage.setItem('other', 'keep')
    clearAllSaved()
    expect(localStorage.getItem('airwise:cache:1,2')).toBeNull()
    expect(localStorage.getItem('other')).toBe('keep')
  })

  it('survives a storage that throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full') })
    expect(() => persist(DEFAULT_SAVED)).not.toThrow()
    spy.mockRestore()
  })
})

describe('input validation', () => {
  it('validates family size', () => {
    expect(parseFamilySize('4')).toEqual({ value: 4 })
    for (const bad of ['', 'abc', '0', '13', '2.5', '-1']) expect(parseFamilySize(bad)).toHaveProperty('error')
  })
  it('falls back to defaults for invalid profile fields', () => {
    expect(sanitizeProfile(null)).toEqual(DEFAULT_SAVED.profile)
    expect(sanitizeProfile({ familySize: 6, purifier: true }).purifier).toBe(true)
  })
})
