import { useEffect, useRef, useState } from 'react'
import { Bot, KeyRound, ShieldCheck, Sparkles } from 'lucide-react'
import type { Advice, Profile } from '../types'
import { buildAdvice, type Context } from '../lib/engine'
import { anonymise, geminiProvider, requestAiAdvice, MODEL } from '../lib/ai'
import { OPTIONS, parseFamilySize } from '../lib/storage'
import { AdviceView, Empty } from './ui'

const LABELS = {
  activity: { minimal: 'Mostly indoors', walking: 'Daily walks / errands', exercise: 'Regular outdoor exercise', outdoorWork: 'Outdoor work or play' },
  commute: { car: 'Personal car', twoWheeler: 'Two-wheeler', publicTransport: 'Public transport', walkCycle: 'Walk or cycle', remote: 'Work/study from home' },
  ventilation: { openable: 'Windows open easily', limited: 'Limited ventilation', acOnly: 'Sealed / AC only' },
}

function Select<K extends 'activity' | 'commute' | 'ventilation'>({ id, name, text, profile, onChange }: {
  id: string; name: K; text: string; profile: Profile; onChange: (p: Profile) => void
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{text}</label>
      <select id={id} value={profile[name]} onChange={(e) => onChange({ ...profile, [name]: e.target.value })}>
        {OPTIONS[name].map((o) => <option key={o} value={o}>{(LABELS[name] as Record<string, string>)[o]}</option>)}
      </select>
    </div>
  )
}

export function ProfileForm({ idPrefix, profile, onChange }: { idPrefix: string; profile: Profile; onChange: (p: Profile) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const parsed = draft === null ? null : parseFamilySize(draft)
  const error = parsed && 'error' in parsed ? parsed.error : ''
  const checks: { key: 'children' | 'elderly' | 'respiratory' | 'purifier'; text: string }[] = [
    { key: 'children', text: 'Children at home' },
    { key: 'elderly', text: 'Older adults at home' },
    { key: 'respiratory', text: 'Someone with respiratory sensitivity' },
    { key: 'purifier', text: 'Air purifier available' },
  ]
  return (
    <form className="form-grid" onSubmit={(e) => e.preventDefault()} noValidate>
      <div className="field">
        <label htmlFor={`${idPrefix}-size`}>Family size</label>
        <input id={`${idPrefix}-size`} inputMode="numeric" value={draft ?? String(profile.familySize)} aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${idPrefix}-size-err` : undefined}
          onChange={(e) => {
            setDraft(e.target.value)
            const r = parseFamilySize(e.target.value)
            if ('value' in r) onChange({ ...profile, familySize: r.value })
          }}
          onBlur={() => setDraft(null)} />
        {error && <p id={`${idPrefix}-size-err`} className="error" role="alert">{error}</p>}
      </div>
      <Select id={`${idPrefix}-act`} name="activity" text="Daily outdoor activity" profile={profile} onChange={onChange} />
      <Select id={`${idPrefix}-com`} name="commute" text="Main commute" profile={profile} onChange={onChange} />
      <Select id={`${idPrefix}-vent`} name="ventilation" text="Home ventilation" profile={profile} onChange={onChange} />
      <fieldset className="checks">
        <legend>Household</legend>
        {checks.map((c) => (
          <label key={c.key} className="check"><input type="checkbox" checked={profile[c.key]} onChange={(e) => onChange({ ...profile, [c.key]: e.target.checked })} />{c.text}</label>
        ))}
      </fieldset>
    </form>
  )
}

function AiPanel({ ctx }: { ctx: Context }) {
  const [key, setKey] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ advice?: Advice; error?: string } | null>(null)
  const alive = useRef(true)

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

  return (
    <div className="ai-panel">
      <h3><Sparkles size={20} aria-hidden="true" />Optional: ask Gemini for AI-generated advice</h3>
      <p className="notice info">
        <ShieldCheck size={18} aria-hidden="true" /> If you continue, an anonymised summary (AQI, PM2.5 band, whether a sensitive family member is present, activity, commute, ventilation and purifier use) is sent from your browser to Google’s Gemini API ({MODEL}). Your city, coordinates, family size and named health conditions are never sent. Your key stays in memory only; it is cleared when you leave the page or press Clear key.
      </p>
      <div className="field">
        <label htmlFor="ai-key">Gemini API key</label>
        <input id="ai-key" type="password" autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} />
      </div>
      <label className="check"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />I understand this summary is sent to the AI provider.</label>
      <div className="row">
        <button className="btn" disabled={busy || !agreed || key.trim().length < 20} onClick={generate}><Bot size={18} aria-hidden="true" />{busy ? 'Generating…' : 'Generate AI advice'}</button>
        <button className="btn secondary" disabled={!key} onClick={() => { setKey(''); setResult(null) }}><KeyRound size={18} aria-hidden="true" />Clear key</button>
      </div>
      <div role="status" aria-live="polite">
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

export default function Assistant({ ctx, onProfile }: { ctx: Context | null; onProfile: (p: Profile) => void }) {
  if (!ctx) return <Empty>Personalised guidance appears once air-quality data is available. Retry loading or switch to sample data.</Empty>
  const advice = buildAdvice(ctx)
  return (
    <div className="assistant">
      <details className="panel" open>
        <summary>Your household</summary>
        <ProfileForm idPrefix="as" profile={ctx.profile} onChange={onProfile} />
      </details>
      <div className="advice-card">
        <p className="tag"><Bot size={16} aria-hidden="true" />Rule-based advice · generated on your device, no AI service called</p>
        <AdviceView advice={advice} />
      </div>
      <AiPanel ctx={ctx} />
    </div>
  )
}
