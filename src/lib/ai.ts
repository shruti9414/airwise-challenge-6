import type { Advice, Profile, Reading } from '../types'
import { BANDS } from './aqi'
import { isSensitive } from './engine'

/** Pluggable provider: swap in any other LLM by implementing this one method. */
export interface AiProvider {
  name: string
  generate(context: AnonymousContext, signal: AbortSignal): Promise<unknown>
}

/** Everything the AI provider is allowed to see: no city, coordinates, family size or named conditions. */
export interface AnonymousContext {
  scale: 'Indian CPCB AQI'
  aqi: number | null
  category: string
  pm25Band: string
  vulnerableMemberPresent: boolean
  outdoorActivity: Profile['activity']
  commute: Profile['commute']
  homeVentilation: Profile['ventilation']
  hasAirPurifier: boolean
}

export function anonymise(reading: Reading, profile: Profile): AnonymousContext {
  const pm25 = reading.pollutants.pm25
  const pmBand = pm25 === null ? 'unknown' : pm25 <= 30 ? 'low' : pm25 <= 60 ? 'moderate' : pm25 <= 120 ? 'high' : 'very high'
  return {
    scale: 'Indian CPCB AQI', aqi: reading.aqi,
    category: BANDS.find((b) => b.id === reading.band)?.label ?? 'unknown',
    pm25Band: pmBand, vulnerableMemberPresent: isSensitive(profile),
    outdoorActivity: profile.activity, commute: profile.commute, homeVentilation: profile.ventilation, hasAirPurifier: profile.purifier,
  }
}

const PROMPT = `You are an air-quality awareness assistant for families in Indian cities.
Use the Indian CPCB AQI scale. Give general awareness guidance only: never diagnose, never promise protection, never guarantee results, recommend following official advisories and seeing a doctor for symptoms.
Reply with JSON only, shaped exactly as {"analysis":string,"meaning":string,"doNow":string[],"avoid":string[],"alternatives":string[],"why":string}.
Each list has 2-4 short plain-text items. No markdown, HTML or links.
Situation: `

const UNSAFE = /<[^>]*>|https?:\/\/|javascript:|\b(guarantee[sd]?|cures?|100% (safe|protect)|completely (safe|protect))/i

const clean = (s: unknown, max: number): string | null => {
  if (typeof s !== 'string') return null
  // eslint-disable-next-line no-control-regex
  const t = s.replace(/[\u0000-\u001f\u007f]/g, ' ').trim()
  return t.length > 0 && t.length <= max && !UNSAFE.test(t) ? t : null
}

const cleanList = (v: unknown): string[] | null => {
  if (!Array.isArray(v) || v.length === 0 || v.length > 6) return null
  const items = v.map((x) => clean(x, 260))
  return items.every((x): x is string => x !== null) ? items : null
}

/** Returns validated advice or null when the response is malformed or contains unsafe content. */
export function validateAdvice(raw: unknown): Advice | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  const analysis = clean(o.analysis, 500), meaning = clean(o.meaning, 500), why = clean(o.why, 500)
  const doNow = cleanList(o.doNow), avoid = cleanList(o.avoid), alternatives = cleanList(o.alternatives)
  return analysis && meaning && why && doNow && avoid && alternatives ? { analysis, meaning, doNow, avoid, alternatives, why } : null
}

export const MODEL = 'gemini-flash-lite-latest'

/** Gemini via the browser. The key is passed in memory per call and never stored. */
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Gemini via the browser. The key is passed in memory per call and never stored. Retries once when the service is busy. */
export const geminiProvider = (apiKey: string): AiProvider => ({
  name: 'Google Gemini',
  async generate(context, signal) {
    const request = () => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT + JSON.stringify(context) }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
      }),
    })
    let res = await request()
    if (res.status === 503 || res.status === 429) {
      await wait(1500)
      res = await request()
    }
    if (!res.ok) throw new Error(res.status === 400 || res.status === 403 ? 'The API key was rejected.' : res.status === 503 ? 'The AI service is busy right now. Try again shortly.' : `The AI service returned status ${res.status}.`)
    const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] }
    const text = (body.candidates?.[0]?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? '').join('')
    return JSON.parse(text || 'null')
  },
})

export type AiResult = { ok: true; advice: Advice } | { ok: false; error: string }

export async function requestAiAdvice(provider: AiProvider, context: AnonymousContext, timeoutMs = 30_000): Promise<AiResult> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const advice = validateAdvice(await provider.generate(context, ctrl.signal))
    return advice ? { ok: true, advice } : { ok: false, error: 'The AI response failed safety validation and was discarded.' }
  } catch (e) {
    return { ok: false, error: ctrl.signal.aborted ? 'The AI request timed out.' : e instanceof Error && e.message ? e.message : 'The AI request failed.' }
  } finally {
    clearTimeout(timer)
  }
}
