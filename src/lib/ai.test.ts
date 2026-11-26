import { describe, expect, it, vi } from 'vitest'
import { anonymise, requestAiAdvice, validateAdvice, type AiProvider } from './ai'
import { assess } from './engine'
import { flatData, profile } from '../testData'

const good = { analysis: 'AQI is poor.', meaning: 'Sensitive people may feel it.', doNow: ['Stay indoors'], avoid: ['Jogging'], alternatives: ['Yoga'], why: 'Particles reach deep into lungs.' }

describe('AI integration safety', () => {
  it('sends only anonymised context', () => {
    const c = assess(flatData(100), profile({ children: true, familySize: 7, respiratory: true }))
    const sent = JSON.stringify(anonymise(c.reading, c.profile))
    for (const secret of ['Delhi', 'familySize', 'respiratory', 'children', '"lat"', '"lon"']) expect(sent).not.toContain(secret)
    expect(sent).toContain('"vulnerableMemberPresent":true')
  })

  it('accepts a well-formed response', () => {
    expect(validateAdvice(good)).toEqual(good)
  })

  it.each([
    ['null', null],
    ['missing field', { ...good, why: undefined }],
    ['empty list', { ...good, doNow: [] }],
    ['non-string item', { ...good, avoid: [5] }],
    ['html', { ...good, analysis: '<img src=x onerror=alert(1)>' }],
    ['link', { ...good, meaning: 'see https://evil.example' }],
    ['guarantee', { ...good, why: 'This guarantees protection' }],
    ['too long', { ...good, analysis: 'x'.repeat(600) }],
  ])('rejects unsafe or malformed response: %s', (_name, raw) => {
    expect(validateAdvice(raw)).toBeNull()
  })

  const ctx = anonymise(assess(flatData(100), profile()).reading, profile())

  it('returns validated advice on success', async () => {
    const p: AiProvider = { name: 't', generate: async () => good }
    expect(await requestAiAdvice(p, ctx)).toEqual({ ok: true, advice: good })
  })

  it('reports errors on provider failure, invalid output and timeout', async () => {
    expect(await requestAiAdvice({ name: 't', generate: async () => { throw new Error('The API key was rejected.') } }, ctx))
      .toEqual({ ok: false, error: 'The API key was rejected.' })
    expect(await requestAiAdvice({ name: 't', generate: async () => ({ nope: 1 }) }, ctx)).toMatchObject({ ok: false })
    vi.useFakeTimers()
    const hang: AiProvider = { name: 't', generate: (_c, s) => new Promise((_r, rej) => s.addEventListener('abort', () => rej(new Error('aborted')))) }
    const pending = requestAiAdvice(hang, ctx, 50)
    await vi.advanceTimersByTimeAsync(60)
    expect(await pending).toEqual({ ok: false, error: 'The AI request timed out.' })
    vi.useRealTimers()
  })
})
