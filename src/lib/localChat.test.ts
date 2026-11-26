import { describe, expect, it } from 'vitest'
import { flatData, profile } from '../testData'
import { assess } from './engine'
import { answerLocally, topicOf } from './localChat'
import { validateAnswer } from './ai'

const ask = (q: string, pm25 = 105, p = {}) => answerLocally(assess(flatData(pm25), profile(p)), q)

describe('keyless local chat', () => {
  it('routes English and Hinglish questions to topics', () => {
    expect(topicOf('Is it safe to send my child to school today?')).toBe('school')
    expect(topicOf('bedroom ki hawa kaise saaf karun')).toBe('indoor')
    expect(topicOf('Should I wear an N95 mask?')).toBe('mask')
    expect(topicOf('I have a cough, what now')).toBe('symptoms')
    expect(topicOf('best commute option?')).toBe('commute')
    expect(topicOf('blah blah blah')).toBeNull()
  })

  it('answers from the live reading and household, not a canned reply', () => {
    const bad = ask('Is it safe to send my child to school?', 300, { children: true })
    const good = ask('Is it safe to send my child to school?', 10, { children: true })
    expect(bad.answer).toMatch(/Severe/)
    expect(bad.answer).toMatch(/indoor/)
    expect(good.answer).toMatch(/fine/)
    expect(bad.answer).not.toBe(good.answer)
  })

  it('makes no guarantees and every answer passes the same validator as AI output', () => {
    for (const q of [
      'school?',
      'bedroom air',
      'window',
      'mask',
      'commute',
      'run outside',
      'best time',
      'am I safe today',
      'cough',
      'hello there',
    ]) {
      for (const pm of [10, 105, 300]) expect(validateAnswer(ask(q, pm, { elderly: true }))).not.toBeNull()
    }
  })

  it('points to medical advice for symptoms and gives a helpful default for off-topic input', () => {
    expect(ask('I feel dizzy and cannot breathe').answer).toMatch(/medical advice/)
    expect(ask('what is the capital of France').answer).toMatch(/I can answer questions about/)
  })
})
