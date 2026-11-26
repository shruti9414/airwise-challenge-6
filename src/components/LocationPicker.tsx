import { useEffect, useState } from 'react'
import { LocateFixed, Search } from 'lucide-react'
import type { Place } from '../types'
import { type GeoResult, reverseGeocode, searchPlaces } from '../lib/airData'
import { CITIES, geoPlace } from '../lib/storage'
import { useDebounced } from '../hooks'
import { Modal } from './ui'

interface Props { idPrefix: string; place: Place; onPlace: (p: Place) => void }

/** Keyed by GeolocationPositionError.code. */
const GEO_ERRORS: Record<number, string> = {
  1: 'Location permission was denied. Allow location for this site in your browser settings, or choose a city instead.',
  2: 'Your device could not work out its location. Choose a city instead.',
  3: 'Finding your location took too long. Try again, or choose a city instead.',
}

export default function LocationPicker({ idPrefix, place, onPlace }: Props) {
  const [query, setQuery] = useState('')
  const debounced = useDebounced(query.trim(), 400)
  const [results, setResults] = useState<{ q: string; items: GeoResult[] | 'error' } | null>(null)
  const [consent, setConsent] = useState(false)
  const [geoError, setGeoError] = useState('')
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    if (debounced.length < 2) return
    const ctrl = new AbortController()
    searchPlaces(debounced, ctrl.signal)
      .then((items) => setResults({ q: debounced, items }))
      .catch(() => { if (!ctrl.signal.aborted) setResults({ q: debounced, items: 'error' }) })
    return () => ctrl.abort()
  }, [debounced])

  const current = debounced.length >= 2 && results?.q === debounced ? results.items : null

  const locate = () => {
    setConsent(false)
    setGeoError('')
    if (!navigator.geolocation) return setGeoError('Your browser does not support location access. Choose a city instead.')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Math.round(pos.coords.latitude * 100) / 100, lon = Math.round(pos.coords.longitude * 100) / 100
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 5000)
        const area = await reverseGeocode(lat, lon, ctrl.signal)
        clearTimeout(timer)
        setLocating(false)
        onPlace(geoPlace(lat, lon, area))
      },
      (err) => { setLocating(false); setGeoError(GEO_ERRORS[err.code] ?? GEO_ERRORS[2]!) },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    )
  }

  return (
    <div className="location">
      <div className="field">
        <label htmlFor={`${idPrefix}-city`}>City</label>
        <select id={`${idPrefix}-city`} value={place.kind === 'city' ? place.name : ''} onChange={(e) => {
          const c = CITIES.find((x) => x.name === e.target.value)
          if (c) onPlace(c)
        }}>
          {place.kind !== 'city' || !CITIES.some((c) => c.name === place.name) ? <option value="">{place.name}</option> : null}
          {CITIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-search`}>Search another Indian city</label>
        <div className="input-icon">
          <Search size={18} aria-hidden="true" />
          <input id={`${idPrefix}-search`} type="search" value={query} maxLength={60} autoComplete="off" onChange={(e) => setQuery(e.target.value)} aria-describedby={`${idPrefix}-search-status`} />
        </div>
        <div id={`${idPrefix}-search-status`} role="status" className="hint">
          {debounced.length >= 2 && current === null && 'Searching…'}
          {current === 'error' && 'Search is unavailable right now. Pick a city from the list.'}
          {Array.isArray(current) && current.length === 0 && 'No matching Indian city found.'}
        </div>
        {Array.isArray(current) && current.length > 0 && (
          <ul className="results" aria-label="Search results">
            {current.map((r) => (
              <li key={`${r.lat},${r.lon}`}>
                <button type="button" className="link-btn" onClick={() => { onPlace({ name: r.name, lat: Math.round(r.lat * 100) / 100, lon: Math.round(r.lon * 100) / 100, kind: 'city' }); setQuery('') }}>
                  {r.name}{r.admin && <span className="muted">, {r.admin}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <button type="button" className="btn secondary" onClick={() => setConsent(true)}><LocateFixed size={18} aria-hidden="true" />Use my location</button>
        {locating && <p className="hint" role="status">Finding your location…</p>}
        {geoError && <p className="error" role="alert">{geoError}</p>}
        <p className="hint">Laptops and desktops usually estimate location from Wi-Fi or IP and can be several km off; phones with GPS are more accurate. Air-quality data covers roughly 10 km, so if the area looks wrong, pick your city instead.</p>
      </div>
      <Modal open={consent} title="Use your location?" onClose={() => setConsent(false)}>
        <p>AirWise will ask your browser for your location once, round it to about 1 km, and use it only to fetch air quality for that area. The rounded coordinates (not your exact position) go to Open-Meteo for air quality and to OpenStreetMap Nominatim to look up the place name; if that lookup fails, the nearest city name is used instead. Nothing is stored.</p>
        <div className="row">
          <button type="button" className="btn" onClick={locate}>Continue</button>
          <button type="button" className="btn secondary" onClick={() => setConsent(false)}>Not now</button>
        </div>
      </Modal>
    </div>
  )
}
