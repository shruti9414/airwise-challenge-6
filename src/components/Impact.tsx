import { useState } from 'react'
import { Leaf, Plus, Trash2 } from 'lucide-react'
import type { Profile, Trip, TripMode } from '../types'
import { alternativesFor } from '../lib/content'
import {
  CAR_FACTOR,
  MODE_FACTOR,
  MODE_LABEL,
  POINTS,
  TRIP_MODES,
  dayKey,
  isTripMode,
  validateTrip,
  weeklyImpact,
} from '../lib/impact'
import { BANDS } from '../lib/aqi'
import type { BandId } from '../types'

export function Alternatives({ profile, band }: { profile: Profile; band: BandId | null }) {
  const { items, paused } = alternativesFor(profile, BANDS.findIndex((b) => b.id === band) >= 3)
  return (
    <>
      {paused && (
        <p className="notice warn" role="status">
          {paused}
        </p>
      )}
      <ul className="alts">
        {items.map((a) => (
          <li key={a.id}>
            <h4>{a.title}</h4>
            <p>{a.text}</p>
          </li>
        ))}
      </ul>
    </>
  )
}

interface Props {
  done: Record<string, string[]>
  trips: Trip[]
  onTrips: (t: Trip[]) => void
}

export function ImpactTracker({ done, trips, onTrips }: Props) {
  const [mode, setMode] = useState<TripMode>('publicTransport')
  const [km, setKm] = useState('')
  const [error, setError] = useState('')
  const w = weeklyImpact({ done, trips })
  const maxPts = Math.max(...w.daily.map((d) => d.points), 10)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const r = validateTrip(mode, km)
    if ('error' in r) return setError(r.error)
    setError('')
    setKm('')
    onTrips([...trips, { id: `${Date.now()}`, date: dayKey(), ...r }].slice(-100))
  }
  const recent = trips.slice(-5).reverse()

  return (
    <div className="impact">
      <dl className="stats">
        <div>
          <dt>Weekly activity score</dt>
          <dd>
            {w.score}
            <small>/100</small>
          </dd>
        </div>
        <div>
          <dt>Low-emission trips</dt>
          <dd>{w.trips}</dd>
        </div>
        <div>
          <dt>Est. CO₂e avoided*</dt>
          <dd>
            {w.co2Kg}
            <small> kg</small>
          </dd>
        </div>
        <div>
          <dt>Healthy habits completed</dt>
          <dd>{w.habits}</dd>
        </div>
        <div>
          <dt>Exposure-reducing habits</dt>
          <dd>{w.exposureHabits}</dd>
        </div>
      </dl>
      <figure>
        <svg
          viewBox="0 0 140 60"
          role="img"
          aria-label={`Points per day over the last 7 days: ${w.daily.map((d) => `${d.date.slice(5)}: ${d.points}`).join(', ')}`}
          className="chart"
        >
          {w.daily.map((d, i) => (
            <rect
              key={d.date}
              x={i * 20 + 3}
              width="14"
              y={54 - (d.points / maxPts) * 50}
              height={Math.max(2, (d.points / maxPts) * 50)}
              rx="2"
              className="bar bar-good"
            />
          ))}
        </svg>
        <figcaption className="hint">
          Points per day, last 7 days (oldest left). Today: {w.daily[6]?.points ?? 0} points.
        </figcaption>
      </figure>
      <form onSubmit={submit} className="trip-form" noValidate>
        <h4>Log a low-emission trip</h4>
        <div className="field">
          <label htmlFor="trip-mode">How did you travel?</label>
          <select id="trip-mode" value={mode} onChange={(e) => isTripMode(e.target.value) && setMode(e.target.value)}>
            {TRIP_MODES.map((m) => (
              <option key={m} value={m}>
                {MODE_LABEL[m]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="trip-km">Distance (km)</label>
          <input
            id="trip-km"
            inputMode="decimal"
            value={km}
            onChange={(e) => setKm(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'trip-err' : undefined}
          />
          {error && (
            <p id="trip-err" className="error" role="alert">
              {error}
            </p>
          )}
        </div>
        <button className="btn" type="submit">
          <Plus size={18} aria-hidden="true" />
          Add trip
        </button>
      </form>
      {recent.length === 0 ? (
        <p className="empty">No trips logged yet. Add one to see your estimate.</p>
      ) : (
        <ul className="trips" aria-label="Recent trips">
          {recent.map((t) => (
            <li key={t.id}>
              <span>
                {t.date} · {MODE_LABEL[t.mode]} · {t.km} km
              </span>
              <button
                className="icon-btn"
                aria-label={`Delete trip on ${t.date}, ${MODE_LABEL[t.mode]}, ${t.km} km`}
                onClick={() => onTrips(trips.filter((x) => x.id !== t.id))}
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <details>
        <summary>
          <Leaf size={16} aria-hidden="true" /> How these numbers are calculated
        </summary>
        <ul className="assumptions">
          <li>
            *Estimated emissions avoided = distance × ({CAR_FACTOR} kg CO₂e/km for an average petrol car − the factor of
            your mode). Factors: walk/cycle 0, public transport {MODE_FACTOR.publicTransport}, carpool{' '}
            {MODE_FACTOR.carpool} per person, combined errands 0 for the car distance saved.
          </li>
          <li>
            Weekly activity score = {POINTS.trip} points per logged trip + {POINTS.habit} per completed habit, capped at{' '}
            {POINTS.cap}.
          </li>
          <li>
            “Healthy habits” counts every checked daily-plan or indoor-air action. “Exposure-reducing habits” counts
            only those that reduce what you breathe; movement/commute actions are excluded.
          </li>
          <li>
            These are personal estimates from self-reported entries. They do not measure, and do not claim to change,
            your city’s AQI, and exposure is not measured or modelled here.
          </li>
        </ul>
      </details>
    </div>
  )
}
