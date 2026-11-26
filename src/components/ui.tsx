import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info, OctagonAlert, ShieldAlert, TriangleAlert, X } from 'lucide-react'
import type { Advice, BandId } from '../types'
import { BANDS } from '../lib/aqi'

const BAND_ICON = { good: CircleCheck, satisfactory: Info, moderate: CircleAlert, poor: TriangleAlert, veryPoor: ShieldAlert, severe: OctagonAlert }

export function BandBadge({ band }: { band: BandId | null }) {
  if (!band) return <span className="badge band-none">Unavailable</span>
  const Icon = BAND_ICON[band]
  return (
    <span className={`badge band-${band}`}>
      <Icon size={16} aria-hidden="true" />
      {BANDS.find((b) => b.id === band)?.label}
    </span>
  )
}

export function Logo() {
  return (
    <span className="logo">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="currentColor" />
        <path d="M8 13h11a3 3 0 1 0-3-3M8 18h15a3 3 0 1 1-3 3M8 23h7" fill="none" stroke="#7fe3b5" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      AirWise
    </span>
  )
}

export function Section({ id, eyebrow, title, intro, children }: { id: string; eyebrow: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="section">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={`${id}-title`}>{title}</h2>
      {intro && <p className="intro">{intro}</p>}
      {children}
    </section>
  )
}

export const Empty = ({ children }: { children: ReactNode }) => <p className="empty" role="status">{children}</p>

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal()
      else d.setAttribute('open', '')
    }
    if (!open && d.open) {
      if (typeof d.close === 'function') d.close()
      else d.removeAttribute('open')
    }
  }, [open])
  return (
    <dialog ref={ref} className="modal" aria-labelledby={titleId} onClose={onClose}>
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Close dialog"><X size={20} aria-hidden="true" /></button>
      </div>
      {open && children}
    </dialog>
  )
}

const ADVICE_PARTS: { key: 'doNow' | 'avoid' | 'alternatives'; title: string }[] = [
  { key: 'doNow', title: 'What to do right now' },
  { key: 'avoid', title: 'What to avoid' },
  { key: 'alternatives', title: 'Better alternatives' },
]

export function AdviceView({ advice, headingLevel = 4 }: { advice: Advice; headingLevel?: 3 | 4 }) {
  const H = `h${headingLevel}` as 'h3' | 'h4'
  return (
    <div className="advice">
      <div><H>Situation analysis</H><p>{advice.analysis}</p></div>
      <div><H>What the risk means</H><p>{advice.meaning}</p></div>
      {ADVICE_PARTS.map(({ key, title }) => (
        <div key={key}>
          <H>{title}</H>
          {advice[key].length ? <ul>{advice[key].map((t) => <li key={t}>{t}</li>)}</ul> : <p className="muted">Nothing specific right now.</p>}
        </div>
      ))}
      <div><H>Why it matters</H><p>{advice.why}</p></div>
    </div>
  )
}
