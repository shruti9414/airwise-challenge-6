import type { Saved, TripMode } from '../types'
import { ACTIONS, ACTIVITIES, CHALLENGES, CHECKLIST, TIPS } from '../lib/content'
import { lastDays } from '../lib/impact'

const COUNTS: Record<string, TripMode[] | null> = { 'car-light': null, 'share-ride': ['publicTransport', 'carpool'], 'one-trip': ['combined'] }

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

export default function Community({ saved, onChange }: { saved: Saved; onChange: (p: Partial<Saved>) => void }) {
  const days = lastDays(7)
  const week = saved.trips.filter((t) => days.includes(t.date))
  return (
    <div className="community">
      <p className="notice sample"><strong>Demo community.</strong> There is no shared community server: challenges and checklists below are examples, and your progress is stored only in this browser.</p>
      <div className="two-col">
        <div>
          <h3>Awareness tips</h3>
          <ul className="bullets">{TIPS.map((t) => <li key={t}>{t}</li>)}</ul>
          <h3>Community action ideas</h3>
          <ul className="bullets">{ACTIONS.map((t) => <li key={t}>{t}</li>)}</ul>
          <h3>School and family activities</h3>
          <ul className="bullets">{ACTIVITIES.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
        <div>
          <h3>Group low-emission challenges</h3>
          <ul className="challenges">
            {CHALLENGES.map((c) => {
              const modes = COUNTS[c.id]
              const n = week.filter((t) => !modes || modes.includes(t.mode)).length
              const joined = saved.joined.includes(c.id)
              return (
                <li key={c.id}>
                  <h4>{c.title}</h4>
                  <p>{c.text}</p>
                  {joined && <p><progress max={c.goal} value={Math.min(n, c.goal)} aria-label={`${c.title} progress`} /> {Math.min(n, c.goal)} of {c.goal}{n >= c.goal ? ' — goal reached!' : ''}</p>}
                  <button className="btn secondary" aria-pressed={joined} onClick={() => onChange({ joined: toggle(saved.joined, c.id) })}>{joined ? 'Leave challenge' : 'Join challenge'}</button>
                </li>
              )
            })}
          </ul>
          <h3>Pollution prevention checklist</h3>
          <ul className="checklist">
            {CHECKLIST.map((c) => (
              <li key={c.id}><label className="check"><input type="checkbox" checked={saved.checklist.includes(c.id)} onChange={() => onChange({ checklist: toggle(saved.checklist, c.id) })} />{c.text}</label></li>
            ))}
          </ul>
          <p className="hint">{saved.checklist.length} of {CHECKLIST.length} complete.</p>
        </div>
      </div>
    </div>
  )
}
