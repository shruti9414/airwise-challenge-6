import type { AirData } from '../types'
import { bandFor } from '../lib/aqi'
import { outlookAt } from '../lib/airData'
import { fmtHour, hourOf } from '../lib/outlook'
import { Empty } from './ui'

export default function Trend({ data }: { data: AirData }) {
  const day = (data.times[data.nowIndex] ?? '').slice(0, 10)
  const rows = data.times.flatMap((t, i) =>
    t.startsWith(day) ? [{ h: hourOf(t), aqi: outlookAt(data, i).aqi, now: i === data.nowIndex }] : [],
  )
  const valid = rows.filter((r): r is typeof r & { aqi: number } => r.aqi !== null)
  if (valid.length === 0) return <Empty>No hourly trend available for today.</Empty>
  const max = Math.max(...valid.map((r) => r.aqi), 100)
  const lo = valid.reduce((a, b) => (b.aqi < a.aqi ? b : a)),
    hi = valid.reduce((a, b) => (b.aqi > a.aqi ? b : a))
  return (
    <div className="trend">
      <h3>Today’s hourly outlook</h3>
      <svg
        viewBox="0 0 240 80"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Hourly outlook index today. Cleanest at ${fmtHour(lo.h)} (${lo.aqi}), highest at ${fmtHour(hi.h)} (${hi.aqi}).`}
      >
        {rows.map(
          (r) =>
            r.aqi !== null && (
              <rect
                key={r.h}
                x={r.h * 10 + 1}
                width="8"
                y={76 - (r.aqi / max) * 70}
                height={(r.aqi / max) * 70}
                rx="2"
                className={`bar bar-${bandFor(r.aqi)?.id}${r.now ? ' now' : ''}`}
              />
            ),
        )}
      </svg>
      <p className="hint">
        Cleanest: {fmtHour(lo.h)} (index {lo.aqi}) · Highest: {fmtHour(hi.h)} (index {hi.aqi}). Outlined bar = current
        hour. This is an hourly outlook index from modelled values to show how the day varies; it is not a CPCB AQI.
      </p>
      <details>
        <summary>View hourly values as a table</summary>
        <div className="table-wrap" role="region" aria-label="Hourly outlook values" tabIndex={0}>
          <table>
            <caption className="sr-only">Hourly outlook index today (not a CPCB AQI)</caption>
            <thead>
              <tr>
                <th scope="col">Hour</th>
                <th scope="col">Index</th>
                <th scope="col">Category</th>
              </tr>
            </thead>
            <tbody>
              {valid.map((r) => (
                <tr key={r.h}>
                  <th scope="row">{fmtHour(r.h)}</th>
                  <td>{r.aqi}</td>
                  <td>{bandFor(r.aqi)?.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
