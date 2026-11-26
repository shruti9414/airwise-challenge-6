import { BellRing, DatabaseZap, MapPin, RefreshCw } from 'lucide-react'
import type { Alert, AirData, Pollutant, Place, Profile, Reading } from '../types'
import type { AirState } from '../hooks'
import { AQI_NOTE, BANDS, POLLUTANT_LABEL, POLLUTANT_UNIT, bandFor, guidanceFor, GUIDANCE_LABEL, subIndex, toDisplayUnit } from '../lib/aqi'
import { isStale, outlookAt } from '../lib/airData'
import { isSensitive } from '../lib/engine'
import { fmtHour } from '../lib/outlook'
import LocationPicker from './LocationPicker'
import { BandBadge, Empty } from './ui'

const hourOf = (t: string) => Number(t.slice(11, 13))

function Gauge({ aqi, reading }: { aqi: number | null; reading: Reading }) {
  const R = 84, C = 100
  const pt = (v: number, r = R) => {
    const a = Math.PI * (1 - Math.min(v, 500) / 500)
    return [C + r * Math.cos(a), C - r * Math.sin(a)] as const
  }
  const arcs = BANDS.map((b, i) => {
    const [x1, y1] = pt(BANDS[i - 1]?.max ?? 0), [x2, y2] = pt(b.max)
    return <path key={b.id} d={`M${x1} ${y1}A${R} ${R} 0 0 1 ${x2} ${y2}`} className={`arc arc-${b.id}`} />
  })
  const [mx, my] = pt(aqi ?? 0)
  const label = aqi === null ? 'AQI unavailable' : `AQI ${aqi}, ${bandFor(aqi)?.label}, on the Indian CPCB scale`
  return (
    <figure className="gauge">
      <svg viewBox="0 0 200 118" role="img" aria-label={label}>
        {arcs}
        {aqi !== null && <circle cx={mx} cy={my} r="9" className="marker" />}
        <text x="100" y="88" textAnchor="middle" className="gauge-num">{aqi ?? '—'}</text>
        <text x="100" y="108" textAnchor="middle" className="gauge-cap">Indian AQI</text>
      </svg>
      <figcaption className="sr-only">{reading.dominant ? `Main pollutant: ${POLLUTANT_LABEL[reading.dominant]}` : 'No main pollutant available'}</figcaption>
    </figure>
  )
}

function Trend({ data }: { data: AirData }) {
  const day = (data.times[data.nowIndex] ?? '').slice(0, 10)
  const rows = data.times.flatMap((t, i) => (t.startsWith(day) ? [{ h: hourOf(t), aqi: outlookAt(data, i).aqi, now: i === data.nowIndex }] : []))
  const valid = rows.filter((r): r is typeof r & { aqi: number } => r.aqi !== null)
  if (valid.length === 0) return <Empty>No hourly trend available for today.</Empty>
  const max = Math.max(...valid.map((r) => r.aqi), 100)
  const lo = valid.reduce((a, b) => (b.aqi < a.aqi ? b : a)), hi = valid.reduce((a, b) => (b.aqi > a.aqi ? b : a))
  return (
    <div className="trend">
      <h3>Today’s hourly outlook</h3>
      <svg viewBox="0 0 240 80" preserveAspectRatio="none" role="img" aria-label={`Hourly outlook index today. Cleanest at ${fmtHour(lo.h)} (${lo.aqi}), highest at ${fmtHour(hi.h)} (${hi.aqi}).`}>
        {rows.map((r) => r.aqi !== null && (
          <rect key={r.h} x={r.h * 10 + 1} width="8" y={76 - (r.aqi / max) * 70} height={(r.aqi / max) * 70} rx="2" className={`bar bar-${bandFor(r.aqi)?.id}${r.now ? ' now' : ''}`} />
        ))}
      </svg>
      <p className="hint">Cleanest: {fmtHour(lo.h)} (index {lo.aqi}) · Highest: {fmtHour(hi.h)} (index {hi.aqi}). Outlined bar = current hour. This is an hourly outlook index from modelled values to show how the day varies; it is not a CPCB AQI.</p>
      <details>
        <summary>View hourly values as a table</summary>
        <div className="table-wrap" role="region" aria-label="Hourly outlook values" tabIndex={0}>
          <table>
            <caption className="sr-only">Hourly outlook index today (not a CPCB AQI)</caption>
            <thead><tr><th scope="col">Hour</th><th scope="col">Index</th><th scope="col">Category</th></tr></thead>
            <tbody>{valid.map((r) => <tr key={r.h}><th scope="row">{fmtHour(r.h)}</th><td>{r.aqi}</td><td>{bandFor(r.aqi)?.label}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  )
}

const ALERT_LABEL = { info: 'Info', warning: 'Warning', critical: 'Critical' }

interface Props {
  state: AirState
  place: Place
  reading: Reading | null
  data: AirData | null
  alerts: Alert[]
  profile: Profile
  onPlace: (p: Place) => void
  onRetry: () => void
  onUseSample: () => void
}

export default function Overview({ state, place, reading, data, alerts, profile, onPlace, onRetry, onUseSample }: Props) {
  const stale = data ? isStale(data) : false
  const guidance = reading ? guidanceFor(reading.band, isSensitive(profile)) : null
  const fmtTime = (ms: number) => new Date(ms).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <>
      <div className="hero">
        <div className="hero-main">
          <p className="place"><MapPin size={18} aria-hidden="true" />{place.name}</p>
          {state.status === 'loading' && <div className="skeleton" role="status" aria-live="polite">Loading air-quality data…</div>}
          {state.status === 'error' && (
            <div role="alert" className="notice warn">
              <p><strong>Live data is unavailable.</strong> {state.message}</p>
              <div className="row">
                <button className="btn" onClick={onRetry}><RefreshCw size={18} aria-hidden="true" />Try again</button>
                <button className="btn secondary" onClick={onUseSample}><DatabaseZap size={18} aria-hidden="true" />View sample data instead</button>
              </div>
            </div>
          )}
          {data && reading && (
            <>
              {data.source === 'sample' && <p className="notice sample"><strong>Sample data.</strong> These values are an illustrative winter-smog day, not a live reading.</p>}
              {stale && <p className="notice warn" role="status"><strong>Data may be outdated.</strong> The latest observation is over 3 hours old.</p>}
              <div className="hero-grid">
                <Gauge aqi={reading.aqi} reading={reading} />
                <div>
                  <BandBadge band={reading.band} />
                  <p className="guidance">{guidance && GUIDANCE_LABEL[guidance]}</p>
                  <p className="muted">{BANDS.find((b) => b.id === reading.band)?.health ?? 'There is not enough valid pollutant data to estimate an AQI.'}</p>
                  <p className="hint">{AQI_NOTE}</p>
                  <dl className="meta">
                    <div><dt>Main pollutant</dt><dd>{reading.dominant ? POLLUTANT_LABEL[reading.dominant] : 'Unavailable'}</dd></div>
                    <div><dt>Observation time</dt><dd>{fmtTime(data.observedAt)}</dd></div>
                    <div><dt>Source</dt><dd>{data.source === 'live' ? 'Open-Meteo Air Quality (CAMS model)' : 'Built-in sample'}</dd></div>
                    {data.weather && <div><dt>Weather</dt><dd>{Math.round(data.weather.temperature)} °C · {Math.round(data.weather.humidity)}% humidity · wind {Math.round(data.weather.windSpeed)} km/h</dd></div>}
                  </dl>
                </div>
              </div>
              {state.status === 'ready' && state.fromCache && data.source === 'live' && <p className="hint">Showing data cached for up to 30 minutes.</p>}
            </>
          )}
        </div>
        <div className="hero-side">
          {data && reading && (
            <>
              <h3>Pollutants</h3>
              <ul className="pollutants">
                {(Object.keys(POLLUTANT_LABEL) as Pollutant[]).map((p) => {
                  const v = reading.pollutants[p]
                  const sub = subIndex(p, v)
                  return (
                    <li key={p}>
                      <span className="p-name">{POLLUTANT_LABEL[p]}</span>
                      <span className="p-val">{v === null ? 'n/a' : `${toDisplayUnit(p, v).toFixed(p === 'co' ? 2 : 0)} ${POLLUTANT_UNIT[p]}`}</span>
                      <span className="p-band">{sub === null ? 'Unavailable' : `${bandFor(sub)?.label} (${sub})`}</span>
                    </li>
                  )
                })}
              </ul>
              <p className="hint">CPCB averaging: 24-hour mean for PM2.5, PM10, NO₂ and SO₂; 8-hour mean for CO and O₃. “n/a” means too few valid hours. Sub-index shown in brackets.</p>
            </>
          )}
          <details className="loc-details">
            <summary>Change location</summary>
            <LocationPicker idPrefix="ov" place={place} onPlace={onPlace} />
          </details>
        </div>
      </div>
      {data ? <Trend data={data} /> : <div className="trend trend-ph" aria-hidden="true" />}
      <div className="alerts">
        <h3><BellRing size={20} aria-hidden="true" />Smart alerts</h3>
        {alerts.length === 0
          ? <Empty>No active alerts. Air quality is within comfortable limits.</Empty>
          : <ul>{alerts.map((a) => (
            <li key={a.id} className={`alert alert-${a.severity}`}>
              <span className="badge">{ALERT_LABEL[a.severity]}</span>
              <div><strong>{a.title}</strong><p>{a.detail}</p></div>
            </li>
          ))}</ul>}
      </div>
    </>
  )
}
