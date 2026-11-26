import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flatData, profile } from '../testData'
import { anonymise, geminiProvider, requestAiAnswer } from './ai'
import { assess } from './engine'

const KEY = 'k'.repeat(30)
const context = () => {
  const c = assess(flatData(100), profile())
  return anonymise(c.reading, c.profile)
}
const reply = (parts: object[]) => ({
  ok: true,
  status: 200,
  json: async () => ({ candidates: [{ content: { parts } }] }),
})
const answer = (text: string) => reply([{ text: JSON.stringify({ answer: text, steps: [] }) }])

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('Gemini provider', () => {
  it('retries once after a busy response and then succeeds', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce(answer('Keep windows closed today.'))
    vi.stubGlobal('fetch', f)
    const pending = requestAiAnswer(geminiProvider(KEY), context(), 'Should I open the window?')
    await vi.advanceTimersByTimeAsync(1600)
    expect(await pending).toMatchObject({ ok: true, answer: { answer: 'Keep windows closed today.' } })
    expect(f).toHaveBeenCalledTimes(2)
  })

  it('retries once on rate limiting, then reports the status when it persists', async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, status: 429 })
    vi.stubGlobal('fetch', f)
    const pending = requestAiAnswer(geminiProvider(KEY), context(), 'Should I open the window?')
    await vi.advanceTimersByTimeAsync(1600)
    expect(await pending).toEqual({ ok: false, error: 'The AI service returned status 429.' })
    expect(f).toHaveBeenCalledTimes(2)
  })

  it('tells the user when the service stays busy', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    const pending = requestAiAnswer(geminiProvider(KEY), context(), 'Should I open the window?')
    await vi.advanceTimersByTimeAsync(1600)
    expect(await pending).toEqual({ ok: false, error: 'The AI service is busy right now. Try again shortly.' })
  })

  it('does not retry a rejected key and never puts the key in the URL', async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, status: 403 })
    vi.stubGlobal('fetch', f)
    const result = await requestAiAnswer(geminiProvider(KEY), context(), 'Should I open the window?')
    expect(result).toEqual({ ok: false, error: 'The API key was rejected.' })
    expect(f).toHaveBeenCalledTimes(1)
    const [url, init] = f.mock.calls[0] as [string, RequestInit]
    expect(url).not.toContain(KEY)
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(KEY)
  })

  it('ignores the model’s thinking parts and fails safely on an empty reply', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          reply([
            { thought: true, text: 'internal reasoning' },
            { text: JSON.stringify({ answer: 'Stay indoors if you can.', steps: [] }) },
          ]),
        ),
    )
    expect(await requestAiAnswer(geminiProvider(KEY), context(), 'Is it safe outside?')).toMatchObject({
      ok: true,
      answer: { answer: 'Stay indoors if you can.' },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply([])))
    expect(await requestAiAnswer(geminiProvider(KEY), context(), 'Is it safe outside?')).toMatchObject({ ok: false })
  })

  it('times out a request that never answers', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(
          (_url: string, init: RequestInit) =>
            new Promise((_resolve, reject) =>
              init.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
            ),
        ),
    )
    const pending = requestAiAnswer(geminiProvider(KEY), context(), 'Is it safe outside?', 1000)
    await vi.advanceTimersByTimeAsync(1100)
    expect(await pending).toEqual({ ok: false, error: 'The AI request timed out.' })
  })
})
