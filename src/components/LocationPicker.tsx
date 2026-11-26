import { useState } from 'react'
import { LocateFixed } from 'lucide-react'
import type { Place } from '../types'
import { reverseGeocode } from '../lib/airData'
import { CITIES, geoPlace } from '../lib/storage'
import { roundTo } from '../lib/util'
import CitySearch from './CitySearch'
import { Modal } from './ui'

interface Props {
  idPrefix: string
  place: Place
  onPlace: (p: Place) => void
}

const GEO_UNAVAILABLE = 'Your device could not work out its location. Choose a city instead.'

/** Keyed by GeolocationPositionError.code. */
const GEO_ERRORS: Record<number, string> = {
  1: 'Location permission was denied. Allow location for this site in your browser settings, or choose a city instead.',
  2: GEO_UNAVAILABLE,
  3: 'Finding your location took too long. Try again, or choose a city instead.',
}

const GEO_OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 }
const NAME_LOOKUP_TIMEOUT_MS = 5000

/** One-shot device location: a fresh fix, rounded to ~1 km and named by a reverse lookup with a safe fallback. */
function useDeviceLocation(onPlace: (p: Place) => void) {
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')

  const locate = () => {
    setError('')
    if (!navigator.geolocation) return setError('Your browser does not support location access. Choose a city instead.')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = roundTo(pos.coords.latitude, 2)
        const lon = roundTo(pos.coords.longitude, 2)
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), NAME_LOOKUP_TIMEOUT_MS)
        const area = await reverseGeocode(lat, lon, ctrl.signal)
        clearTimeout(timer)
        setLocating(false)
        onPlace(geoPlace(lat, lon, area))
      },
      (err) => {
        setLocating(false)
        setError(GEO_ERRORS[err.code] ?? GEO_UNAVAILABLE)
      },
      GEO_OPTIONS,
    )
  }
  return { locating, error, locate }
}

export default function LocationPicker({ idPrefix, place, onPlace }: Props) {
  const [consent, setConsent] = useState(false)
  const { locating, error, locate } = useDeviceLocation(onPlace)
  const isPreset = place.kind === 'city' && CITIES.some((c) => c.name === place.name)

  return (
    <div className="location">
      <div className="field">
        <label htmlFor={`${idPrefix}-city`}>City</label>
        <select
          id={`${idPrefix}-city`}
          value={place.kind === 'city' ? place.name : ''}
          onChange={(e) => {
            const c = CITIES.find((x) => x.name === e.target.value)
            if (c) onPlace(c)
          }}
        >
          {isPreset ? null : <option value="">{place.name}</option>}
          {CITIES.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <CitySearch idPrefix={idPrefix} onPlace={onPlace} />
      <div>
        <button type="button" className="btn secondary" onClick={() => setConsent(true)}>
          <LocateFixed size={18} aria-hidden="true" />
          Use my location
        </button>
        {locating && (
          <p className="hint" role="status">
            Finding your location…
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <p className="hint">
          Laptops and desktops usually estimate location from Wi-Fi or IP and can be several km off; phones with GPS are
          more accurate. Air-quality data covers roughly 10 km, so if the area looks wrong, pick your city instead.
        </p>
      </div>
      <Modal open={consent} title="Use your location?" onClose={() => setConsent(false)}>
        <p>
          AirWise will ask your browser for your location once, round it to about 1 km, and use it only to fetch air
          quality for that area. The rounded coordinates (not your exact position) go to Open-Meteo for air quality and
          to OpenStreetMap Nominatim to look up the place name; if that lookup fails, the nearest city name is used
          instead. Nothing is stored.
        </p>
        <div className="row">
          <button
            type="button"
            className="btn"
            onClick={() => {
              setConsent(false)
              locate()
            }}
          >
            Continue
          </button>
          <button type="button" className="btn secondary" onClick={() => setConsent(false)}>
            Not now
          </button>
        </div>
      </Modal>
    </div>
  )
}
