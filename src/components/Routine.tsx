import { Moon, Sun, Sunrise, Sunset } from 'lucide-react'
import type { Context } from '../lib/engine'
import { buildRoutine } from '../lib/routine'
import { PERIODS, PERIOD_IDS, currentHour, periodOf, periodOutlook } from '../lib/outlook'
import { BandBadge, Empty } from './ui'

const ICONS = { morning: Sunrise, afternoon: Sun, evening: Sunset, night: Moon }

export interface Checklist {
  done: string[]
  toggle: (id: string) => void
}

export default function Routine({ ctx, list }: { ctx: Context | null; list: Checklist }) {
  if (!ctx) return <Empty>Your daily plan appears once air-quality data is available.</Empty>
  const routine = buildRoutine(ctx)
  const all = Object.values(routine).flat()
  const doneCount = all.filter((i) => list.done.includes(i.id)).length
  const now = periodOf(currentHour(ctx.data))
  return (
    <>
      <div className="progress">
        <label htmlFor="plan-progress">
          Today’s progress: {doneCount} of {all.length} actions done
        </label>
        <progress id="plan-progress" max={all.length} value={doneCount} />
      </div>
      <div className="period-grid">
        {PERIOD_IDS.map((p) => {
          const Icon = ICONS[p]
          const out = periodOutlook(ctx.data, p)
          return (
            <article key={p} className={`period${p === now ? ' current' : ''}`} aria-labelledby={`per-${p}`}>
              <header>
                <h3 id={`per-${p}`}>
                  <Icon size={20} aria-hidden="true" />
                  {PERIODS[p].label}
                  {p === now && <span className="tag">Now</span>}
                </h3>
                <BandBadge band={out?.band ?? null} />
              </header>
              <ul>
                {routine[p].map((i) => (
                  <li key={i.id}>
                    <label className="check">
                      <input type="checkbox" checked={list.done.includes(i.id)} onChange={() => list.toggle(i.id)} />
                      <span>
                        {i.text}
                        <small className="reason">Why: {i.reason}</small>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </article>
          )
        })}
      </div>
    </>
  )
}
