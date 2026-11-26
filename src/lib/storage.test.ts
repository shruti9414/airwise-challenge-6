import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_SAVED,
  STORAGE_KEY,
  clearAllSaved,
  geoPlace,
  loadSaved,
  nearestCity,
  parseFamilySize,
  persist,
  sanitizeProfile,
  sanitizeSaved,
} from './storage'

beforeEach(() => localStorage.clear())

describe('local storage handling', () => {
  it('returns defaults when nothing or garbage is stored', () => {
    expect(loadSaved()).toEqual(DEFAULT_SAVED)
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(loadSaved()).toEqual(DEFAULT_SAVED)
  })

  it('round-trips valid state', () => {
    const s = {
      ...DEFAULT_SAVED,
      joined: ['car-light'],
      trips: [{ id: 'a', date: '2026-11-26', mode: 'walk' as const, km: 2 }],
    }
    persist(s)
    expect(loadSaved()).toEqual(s)
  })

  it('sanitises tampered values', () => {
    const s = sanitizeSaved({
      place: { name: '<script>', lat: 999, lon: 1, kind: 'city' },
      profile: { familySize: 9999, commute: 'rocket', children: 'yes' },
      trips: [
        { id: 'x', date: 'bad', mode: 'walk', km: 1 },
        { id: 'y', date: '2026-11-26', mode: 'walk', km: -4 },
      ],
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

  it('rejects trip modes that are inherited object keys, not real modes', () => {
    const trip = (mode: string) => ({ id: mode, date: '2026-11-26', mode, km: 2 })
    const modes = ['toString', 'constructor', '__proto__', 'hasOwnProperty', 'valueOf', '']
    expect(sanitizeSaved({ trips: modes.map(trip) }).trips).toEqual([])
    expect(sanitizeSaved({ trips: [trip('walk'), trip('toString')] }).trips.map((t) => t.mode)).toEqual(['walk'])
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
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full')
    })
    expect(() => persist(DEFAULT_SAVED)).not.toThrow()
    spy.mockRestore()
  })
})

describe('device location naming', () => {
  it('labels a position by the nearest preset city within 60 km', () => {
    expect(nearestCity(28.7041, 77.1025)?.name).toBe('Delhi')
    expect(nearestCity(19.2, 72.9)?.name).toBe('Mumbai')
    expect(nearestCity(21.15, 79.09)).toBeNull()
  })

  it('rounds coordinates to about 1 km and never claims a city that is far away', () => {
    expect(geoPlace(28.70412, 77.10259)).toEqual({ name: 'Near Delhi (approx.)', lat: 28.7, lon: 77.1, kind: 'geo' })
    expect(geoPlace(21.1458, 79.0882).name).toBe('Your location (approx.)')
    expect(geoPlace(21.1458, 79.0882, 'Nagpur, Maharashtra').name).toBe('Nagpur, Maharashtra (approx.)')
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
