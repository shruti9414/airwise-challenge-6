import { KeyRound, ShieldCheck, Sparkles } from 'lucide-react'
import { MODEL } from '../lib/ai'

interface Props {
  apiKey: string
  onKey: (key: string) => void
  agreed: boolean
  onAgreed: (agreed: boolean) => void
  /** True when a plausible key is entered and consent is given. */
  ready: boolean
  busy: boolean
  onGenerate: () => void
  onClear: () => void
}

/** Optional Gemini controls: disclosure, key (memory only), consent, full-advice and clear-key actions. */
export default function GeminiSettings({ apiKey, onKey, agreed, onAgreed, ready, busy, onGenerate, onClear }: Props) {
  return (
    <details className="panel">
      <summary>Optional: use Gemini AI (needs your own API key)</summary>
      <p className="notice info">
        <ShieldCheck size={18} aria-hidden="true" /> If you continue, an anonymised summary (AQI, PM2.5 band, whether a
        sensitive family member is present, activity, commute, ventilation and purifier use) and the question you type
        are sent from your browser to Google’s Gemini API ({MODEL}). Your city, coordinates, family size and named
        health conditions are never sent by AirWise, so please do not type names, addresses, phone numbers or health
        details in your question. Your key stays in memory only; it is cleared when you leave the page or press Clear
        key.
      </p>
      <div className="field">
        <label htmlFor="ai-key">Gemini API key</label>
        <input
          id="ai-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={apiKey}
          onChange={(e) => onKey(e.target.value)}
        />
      </div>
      <label className="check">
        <input type="checkbox" checked={agreed} onChange={(e) => onAgreed(e.target.checked)} />I understand this summary
        and my question are sent to the AI provider.
      </label>
      <div className="row">
        <button className="btn secondary" type="button" disabled={busy || !ready} onClick={onGenerate}>
          <Sparkles size={18} aria-hidden="true" />
          Generate full AI advice
        </button>
        <button className="btn secondary" type="button" disabled={!apiKey} onClick={onClear}>
          <KeyRound size={18} aria-hidden="true" />
          Clear key
        </button>
      </div>
    </details>
  )
}
