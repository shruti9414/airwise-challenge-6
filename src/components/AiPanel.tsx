import { useEffect, useRef, useState } from 'react'
import { Bot, MessageCircle, Sparkles } from 'lucide-react'
import type { Context } from '../lib/engine'
import { MAX_QUESTION, anonymise, checkQuestion, geminiProvider, requestAiAdvice, requestAiAnswer } from '../lib/ai'
import { answerLocally } from '../lib/localChat'
import ChatResults, { type AdviceResult, type Turn } from './ChatResults'
import GeminiSettings from './GeminiSettings'

const EXAMPLES = [
  'Is it safe to send my child to school today?',
  'How can I clean the air in my bedroom tonight?',
  'What is the lowest-emission way to commute today?',
]

const MAX_TURNS = 8
const MIN_KEY_LENGTH = 20

export default function AiPanel({ ctx }: { ctx: Context }) {
  const [key, setKey] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [question, setQuestion] = useState('')
  const [qError, setQError] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [result, setResult] = useState<AdviceResult | null>(null)
  const alive = useRef(true)
  const ready = agreed && key.trim().length >= MIN_KEY_LENGTH

  useEffect(() => {
    alive.current = true
    const wipe = () => setKey('')
    window.addEventListener('pagehide', wipe)
    return () => {
      alive.current = false
      window.removeEventListener('pagehide', wipe)
    }
  }, [])

  const provider = () => geminiProvider(key.trim())
  const context = () => anonymise(ctx.reading, ctx.profile)
  const addTurn = (turn: Omit<Turn, 'id'>) =>
    setTurns((t) => [...t, { id: Date.now() + t.length, ...turn }].slice(-MAX_TURNS))

  const generate = async () => {
    setBusy(true)
    setResult(null)
    const r = await requestAiAdvice(provider(), context())
    if (!alive.current) return
    setBusy(false)
    setResult(r.ok ? { advice: r.advice } : { error: r.error })
  }

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
    const r = await requestAiAnswer(provider(), context(), checked.question)
    if (!alive.current) return
    setBusy(false)
    addTurn({ q: checked.question, ...(r.ok ? { answer: r.answer } : { error: r.error }) })
    if (r.ok) setQuestion('')
  }

  const clearKey = () => {
    setKey('')
    setResult(null)
    setTurns([])
  }

  return (
    <div className="ai-panel">
      <h3>
        <MessageCircle size={20} aria-hidden="true" />
        Ask a question
      </h3>
      <p className="hint">
        Works instantly with no key: answers come from your device using today’s air quality and your household. Add a
        Gemini key below only if you want an AI-written answer.
      </p>

      <form onSubmit={askLocal} className="chat-form" noValidate>
        <div className="field">
          <label htmlFor="ai-q">Your question</label>
          <textarea
            id="ai-q"
            rows={3}
            maxLength={MAX_QUESTION}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            aria-invalid={qError ? true : undefined}
            aria-describedby={qError ? 'ai-q-hint ai-q-err' : 'ai-q-hint'}
          />
          <p id="ai-q-hint" className="hint">
            {question.length}/{MAX_QUESTION} characters. Ask about air quality, indoor air or low-emission habits.
          </p>
          {qError && (
            <p id="ai-q-err" className="error" role="alert">
              {qError}
            </p>
          )}
        </div>
        <div className="chips" role="group" aria-label="Example questions">
          {EXAMPLES.map((x) => (
            <button
              key={x}
              type="button"
              className="chip"
              onClick={() => {
                setQuestion(x)
                setQError('')
              }}
            >
              {x}
            </button>
          ))}
        </div>
        <div className="row">
          <button className="btn" type="submit" disabled={busy}>
            <Bot size={18} aria-hidden="true" />
            Get instant answer
          </button>
          <button
            className="btn secondary"
            type="button"
            disabled={busy || !ready}
            aria-describedby="gemini-hint"
            onClick={askGemini}
          >
            <Sparkles size={18} aria-hidden="true" />
            {busy ? 'Thinking…' : 'Ask Gemini'}
          </button>
        </div>
        <p id="gemini-hint" className="hint">
          “Ask Gemini” is optional: it needs your own Gemini API key and consent (open “Optional: use Gemini AI” below).
        </p>
      </form>

      <GeminiSettings
        apiKey={key}
        onKey={setKey}
        agreed={agreed}
        onAgreed={setAgreed}
        ready={ready}
        busy={busy}
        onGenerate={generate}
        onClear={clearKey}
      />
      <ChatResults turns={turns} result={result} />
    </div>
  )
}
