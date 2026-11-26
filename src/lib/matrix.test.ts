import { describe, expect, it } from 'vitest'
import type { Profile } from '../types'
import { flatData, profile } from '../testData'
import { buildAdvice } from './advice'
import { buildAlerts } from './alerts'
import { sampleData } from './airData'
import { validateAnswer } from './ai'
import { assess } from './engine'
import { answerLocally } from './localChat'
import { buildRoutine } from './routine'
import { OPTIONS } from './storage'

/** Sweeps the recommendation engine across many household and air-quality combinations. */
const PM25_LEVELS = [5, 45, 75, 105, 150, 220, 400]
const FLAGS: Partial<Profile>[] = [
  {},
  { children: true },
  { elderly: true },
  { respiratory: true },
  { children: true, elderly: true, respiratory: true },
]

function* households(): Generator<Profile> {
  for (const flags of FLAGS)
    for (const commute of OPTIONS.commute)
      for (const ventilation of OPTIONS.ventilation)
        for (const activity of OPTIONS.activity)
          for (const purifier of [false, true]) yield profile({ ...flags, commute, ventilation, activity, purifier })
}

const BROKEN = /undefined|NaN|\[object|null/
const label = (p: Profile, pm: number) => `${JSON.stringify(p)} at PM2.5 ${pm}`

describe('recommendation engine across every household and AQI level', () => {
  it('always produces complete, readable, non-repeating advice', () => {
    for (const p of households()) {
      for (const pm of PM25_LEVELS) {
        const advice = buildAdvice(assess(flatData(pm), p))
        const where = label(p, pm)
        for (const text of [advice.analysis, advice.meaning, advice.why]) {
          expect(text.length, where).toBeGreaterThan(10)
          expect(text, where).not.toMatch(BROKEN)
        }
        const lists = [advice.doNow, advice.avoid, advice.alternatives]
        for (const list of lists) {
          expect(new Set(list).size, where).toBe(list.length)
          for (const line of list) expect(line, where).not.toMatch(BROKEN)
        }
        expect(advice.doNow.length, where).toBeGreaterThan(0)
        expect(advice.avoid.length, where).toBeGreaterThan(0)
      }
    }
  })

  it('always produces a four-period routine with unique ids and a reason on every item', () => {
    for (const p of households()) {
      for (const data of [
        flatData(30),
        flatData(150),
        ...[3, 9, 14, 20].map((h) => sampleData(new Date(2026, 10, 26, h))),
      ]) {
        const routine = buildRoutine(assess(data, p))
        const items = Object.values(routine).flat()
        const ids = items.map((i) => i.id)
        expect(new Set(ids).size, JSON.stringify(p)).toBe(ids.length)
        for (const item of items) {
          expect(item.text.length).toBeGreaterThan(5)
          expect(item.reason.length).toBeGreaterThan(5)
          expect(`${item.text} ${item.reason}`).not.toMatch(BROKEN)
        }
        for (const period of Object.values(routine)) expect(period.length).toBeGreaterThan(0)
      }
    }
  })

  it('always produces well-formed alerts', () => {
    for (const p of [profile(), profile({ children: true }), profile({ elderly: true, respiratory: true })]) {
      for (const data of [
        flatData(5),
        flatData(75),
        flatData(400),
        ...[3, 7, 12, 18].map((h) => sampleData(new Date(2026, 10, 26, h))),
      ]) {
        const alerts = buildAlerts(assess(data, p))
        const ids = alerts.map((a) => a.id)
        expect(new Set(ids).size).toBe(ids.length)
        for (const a of alerts) {
          expect(['info', 'warning', 'critical']).toContain(a.severity)
          expect(`${a.title} ${a.detail}`).not.toMatch(BROKEN)
        }
      }
    }
  })

  it('answers every kind of question safely for every household', () => {
    const questions = [
      'Is it safe to send my child to school today?',
      'How do I clean the air in my bedroom?',
      'Should I open the window?',
      'Do I need an N95 mask?',
      'What is the best way to commute?',
      'Can I go for a run outside?',
      'When is the best time to go out?',
      'Is it safe outside right now?',
      'I have a cough and feel dizzy',
      'hello',
    ]
    for (const p of households()) {
      for (const pm of [10, 105, 300]) {
        for (const q of questions) {
          const answer = answerLocally(assess(flatData(pm), p), q)
          expect(validateAnswer(answer), `${q} / ${label(p, pm)}`).not.toBeNull()
        }
      }
    }
  })
})
