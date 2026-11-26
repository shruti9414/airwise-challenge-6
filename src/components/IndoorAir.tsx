import { Wind } from 'lucide-react'
import { rankHacks } from '../lib/content'
import type { Context } from '../lib/engine'
import { bestWindow, fmtHour } from '../lib/outlook'
import { BANDS } from '../lib/aqi'
import { Empty } from './ui'
import type { Checklist } from './Routine'

function windowAdvice(ctx: Context): { verdict: string; detail: string } {
  const idx = BANDS.findIndex((b) => b.id === ctx.reading.band)
  const win = bestWindow(ctx.data)
  if (ctx.reading.band === null)
    return {
      verdict: 'Unknown',
      detail:
        'No particulate data, so AirWise cannot advise on opening windows. Keep them closed if the air looks hazy.',
    }
  if (ctx.profile.ventilation === 'acOnly')
    return {
      verdict: 'Not applicable',
      detail: 'Your home is sealed or AC-only: maintain filters and use the AC’s recirculation setting on smog days.',
    }
  if (idx <= 1)
    return {
      verdict: 'Open now',
      detail: 'Outdoor air is relatively clean: open windows for 10–15 minutes to flush indoor pollutants.',
    }
  if (idx === 2)
    return {
      verdict: 'Briefly, if needed',
      detail: `Outdoor air is Moderate. Air rooms only briefly${win ? `, ideally ${fmtHour(win.start)}–${fmtHour(win.end)}` : ''}, and especially after cooking.`,
    }
  return {
    verdict: 'Keep closed',
    detail: `Outdoor air is ${BANDS[idx]?.label}. Keep windows closed${win && ctx.profile.ventilation === 'openable' ? `; if you must air a room, ${fmtHour(win.start)}–${fmtHour(win.end)} is forecast to be the least polluted` : ''}.`,
  }
}

export default function IndoorAir({ ctx, list }: { ctx: Context | null; list: Checklist }) {
  if (!ctx) return <Empty>Indoor air guidance appears once air-quality data is available.</Empty>
  const pm25 = ctx.reading.pollutants.pm25
  const v = windowAdvice(ctx)
  const hacks = rankHacks({
    pmHigh: pm25 !== null && pm25 > 60,
    purifier: ctx.profile.purifier,
    severe: BANDS.findIndex((b) => b.id === ctx.reading.band) >= 3,
    openable: ctx.profile.ventilation === 'openable',
  })
  return (
    <>
      <div className="callout">
        <Wind size={22} aria-hidden="true" />
        <div>
          <h3>
            Should you open windows now? <span className="verdict">{v.verdict}</span>
          </h3>
          <p>{v.detail}</p>
        </div>
      </div>
      <ul className="hacks">
        {hacks.map((h) => (
          <li key={h.id}>
            <details>
              <summary>{h.title}</summary>
              <dl className="hack">
                <div>
                  <dt>What to do</dt>
                  <dd>{h.what}</dd>
                </div>
                <div>
                  <dt>Why it helps</dt>
                  <dd>{h.why}</dd>
                </div>
                <div>
                  <dt>Difficulty</dt>
                  <dd>{h.difficulty}</dd>
                </div>
                <div>
                  <dt>Estimated cost</dt>
                  <dd>{h.cost}</dd>
                </div>
                <div>
                  <dt>Expected benefit</dt>
                  <dd>{h.benefit}</dd>
                </div>
                <div>
                  <dt>Limitations</dt>
                  <dd>{h.limits}</dd>
                </div>
              </dl>
              <label className="check">
                <input type="checkbox" checked={list.done.includes(h.id)} onChange={() => list.toggle(h.id)} />I did
                this today
              </label>
            </details>
          </li>
        ))}
      </ul>
    </>
  )
}
