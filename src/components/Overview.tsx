import { BellRing, DatabaseZap, MapPin, RefreshCw } from 'lucide-react'
import type { Alert, AirData, Place, Profile, Reading } from '../types'
import type { AirState } from '../hooks'
import { guidanceFor } from '../lib/aqi'
import { isStale } from '../lib/airData'
import { isSensitive } from '../lib/engine'
import LocationPicker from './LocationPicker'
import PollutantList from './PollutantList'
import ReadingSummary from './ReadingSummary'
import Trend from './Trend'
import { Empty } from './ui'

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

export default function Overview({
  state,
  place,
  reading,
  data,
  alerts,
  profile,
  onPlace,
  onRetry,
  onUseSample,
}: Props) {
  const stale = data ? isStale(data) : false
  const guidance = reading ? guidanceFor(reading.band, isSensitive(profile)) : null

  return (
    <>
      <div className="hero">
        <div className="hero-main">
          <p className="place">
            <MapPin size={18} aria-hidden="true" />
            {place.name}
          </p>
          {state.status === 'loading' && (
            <div className="skeleton" role="status" aria-live="polite">
              Loading air-quality data…
            </div>
          )}
          {state.status === 'error' && (
            <div role="alert" className="notice warn">
              <p>
                <strong>Live data is unavailable.</strong> {state.message}
              </p>
              <div className="row">
                <button className="btn" onClick={onRetry}>
                  <RefreshCw size={18} aria-hidden="true" />
                  Try again
                </button>
                <button className="btn secondary" onClick={onUseSample}>
                  <DatabaseZap size={18} aria-hidden="true" />
                  View sample data instead
                </button>
              </div>
            </div>
          )}
          {data && reading && (
            <>
              {data.source === 'sample' && (
                <p className="notice sample">
                  <strong>Sample data.</strong> These values are an illustrative winter-smog day, not a live reading.
                </p>
              )}
              {stale && (
                <p className="notice warn" role="status">
                  <strong>Data may be outdated.</strong> The latest observation is over 3 hours old.
                </p>
              )}
              <ReadingSummary reading={reading} data={data} guidance={guidance} />
              {state.status === 'ready' && state.fromCache && data.source === 'live' && (
                <p className="hint">Showing data cached for up to 30 minutes.</p>
              )}
            </>
          )}
        </div>
        <div className="hero-side">
          {data && reading && (
            <>
              <PollutantList reading={reading} />
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
        <h3>
          <BellRing size={20} aria-hidden="true" />
          Smart alerts
        </h3>
        {alerts.length === 0 ? (
          <Empty>No active alerts. Air quality is within comfortable limits.</Empty>
        ) : (
          <ul>
            {alerts.map((a) => (
              <li key={a.id} className={`alert alert-${a.severity}`}>
                <span className="badge">{ALERT_LABEL[a.severity]}</span>
                <div>
                  <strong>{a.title}</strong>
                  <p>{a.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
