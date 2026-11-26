import { useEffect, useRef, useState } from 'react'
import { Bot, KeyRound, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react'
import type { Advice } from '../types'
import type { Context } from '../lib/engine'
import { MAX_QUESTION, MODEL, anonymise, checkQuestion, geminiProvider, requestAiAdvice, requestAiAnswer, type ChatAnswer } from '../lib/ai'
import { answerLocally } from '../lib/localChat'
import { AdviceView } from './ui'

const EXAMPLES = [
  'Is it safe to send my child to school today?',
  'How can I clean the air in my bedroom tonight?',
  'What is the lowest-emission way to commute today?',
]

interface Turn { id: number; q: string; answer?: ChatAnswer; error?: string; local?: boolean }

export default function AiPanel({ ctx }: { ctx: Context }) {
  const [key, setKey] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [question, setQuestion] = useState('')
  const [qError, setQError] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [result, setResult] = useState<{ advice?: Advice; error?: string } | null>(null)
  const alive = useRef(true)
  const ready = agreed && key.trim().length >= 20

  useEffect(() => {
    alive.current = true
    const wipe = () => setKey('')
    window.addEventListener('pagehide', wipe)
    return () => { alive.current = false; window.removeEventListener('pagehide', wipe) }
  }, [])

  const generate = async () => {
    setBusy(true)
    setResult(null)
    const r = await requestAiAdvice(geminiProvider(key.trim()), anonymise(ctx.reading, ctx.profile))
    if (!alive.current) return
    setBusy(false)
    setResult(r.ok ? { advice: r.advice } : { error: r.error })
  }

  const addTurn = (turn: Omit<Turn, 'id'>) => setTurns((t) => [...t, { id: Date.now() + t.length, ...turn }].slice(-8))

  /** No key needed: answered on-device by the rule-based engine. */
  const askLocal = (e: React.FormEvent) => {
    e.preventDefault()
    const checked = checkQuestion(question)
    if ('error' in checked) return setQError(checked.error)
    setQError('')
    addTurn({ q: checked.question, answer: answerLocally(ctx, checked.question), local: true })
    setQuestion('')
  }

  const askGemini = async () => {
    const checked = checkQuestion(question)
    if ('error' in checked) return setQError(checked.error)
    setQError('')
    setBusy(true)
    const r = await requestAiAnswer(geminiProvider(key.trim()), anonymise(ctx.reading, ctx.profile), checked.question)
    if (!alive.current) return
    setBusy(false)
    addTurn({ q: checked.question, ...(r.ok ? { answer: r.answer } : { error: r.error }) })
    if (r.ok) setQuestion('')
  }

  return (
    <div className="ai-panel">
      <h3><MessageCircle size={20} aria-hidden="true" />Ask a question</h3>
      <p className="hint">Works instantly with no key: answers come from your device using today’s air quality and your household. Add a Gemini key below only if you want an AI-written answer.</p>

      <form onSubmit={askLocal} className="chat-form" noValidate>
        <div className="field">
          <label htmlFor="ai-q">Your question</label>
          <textarea id="ai-q" rows={3} maxLength={MAX_QUESTION} value={question} onChange={(e) => setQuestion(e.target.value)}
            aria-invalid={qError ? true : undefined} aria-describedby={qError ? 'ai-q-hint ai-q-err' : 'ai-q-hint'} />
          <p id="ai-q-hint" className="hint">{question.length}/{MAX_QUESTION} characters. Ask about air quality, indoor air or low-emission habits.</p>
          {qError && <p id="ai-q-err" className="error" role="alert">{qError}</p>}
        </div>
        <div className="chips" role="group" aria-label="Example questions">
          {EXAMPLES.map((x) => <button key={x} type="button" className="chip" onClick={() => { setQuestion(x); setQError('') }}>{x}</button>)}
        </div>
        <div className="row">
          <button className="btn" type="submit" disabled={busy}><Bot size={18} aria-hidden="true" />Get instant answer</button>
          <button className="btn secondary" type="button" disabled={busy || !ready} aria-describedby="gemini-hint" onClick={askGemini}><Sparkles size={18} aria-hidden="true" />{busy ? 'Thinking…' : 'Ask Gemini'}</button>
        </div>
        <p id="gemini-hint" className="hint">“Ask Gemini” is optional: it needs your own Gemini API key and consent (open “Optional: use Gemini AI” below).</p>
      </form>

      <details className="panel">
        <summary>Optional: use Gemini AI (needs your own API key)</summary>
        <p className="notice info">
          <ShieldCheck size={18} aria-hidden="true" /> If you continue, an anonymised summary (AQI, PM2.5 band, whether a sensitive family member is present, activity, commute, ventilation and purifier use) and the question you type are sent from your browser to Google’s Gemini API ({MODEL}). Your city, coordinates, family size and named health conditions are never sent by AirWise, so please do not type names, addresses, phone numbers or health details in your question. Your key stays in memory only; it is cleared when you leave the page or press Clear key.
        </p>
        <div className="field">
          <label htmlFor="ai-key">Gemini API key</label>
          <input id="ai-key" type="password" autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} />
        </div>
        <label className="check"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />I understand this summary and my question are sent to the AI provider.</label>
        <div className="row">
          <button className="btn secondary" type="button" disabled={busy || !ready} onClick={generate}><Sparkles size={18} aria-hidden="true" />Generate full AI advice</button>
          <button className="btn secondary" type="button" disabled={!key} onClick={() => { setKey(''); setResult(null); setTurns([]) }}><KeyRound size={18} aria-hidden="true" />Clear key</button>
        </div>
      </details>

      <div role="status" aria-live="polite">
        {turns.map((t) => (
          <div key={t.id} className={`advice-card chat-turn${t.local ? '' : ' ai'}`}>
            <p className="you"><strong>You asked:</strong> {t.q}</p>
            {t.answer && (
              <>
                {t.local
                  ? <p className="tag"><Bot size={16} aria-hidden="true" />Rule-based answer · generated on your device, no AI service called</p>
                  : <p className="tag ai-tag"><Sparkles size={16} aria-hidden="true" />AI-generated by Gemini · checked by AirWise’s safety validator</p>}
                <p>{t.answer.answer}</p>
                {t.answer.steps.length > 0 && <ul className="bullets">{t.answer.steps.map((s) => <li key={s}>{s}</li>)}</ul>}
              </>
            )}
            {t.error && <p className="notice warn">{t.error} The rule-based advice above remains your fallback.</p>}
          </div>
        ))}
        {result?.error && <p className="notice warn">{result.error} The rule-based advice above remains your fallback.</p>}
        {result?.advice && (
          <div className="advice-card ai">
            <p className="tag ai-tag"><Sparkles size={16} aria-hidden="true" />AI-generated by Gemini · checked by AirWise’s safety validator</p>
            <AdviceView advice={result.advice} />
          </div>
        )}
      </div>
    </div>
  )
}
