import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import type { Place, Profile } from '../types'
import LocationPicker from './LocationPicker'
import { ProfileForm } from './Assistant'
import { Modal } from './ui'

interface Props {
  place: Place
  profile: Profile
  useSample: boolean
  onPlace: (p: Place) => void
  onProfile: (p: Profile) => void
  onSample: (v: boolean) => void
  onReset: () => void
}

export default function Settings({ place, profile, useSample, onPlace, onProfile, onSample, onReset }: Props) {
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="settings">
      <div className="two-col">
        <div className="panel"><h3>Location</h3><LocationPicker idPrefix="set" place={place} onPlace={onPlace} /></div>
        <div className="panel"><h3>Household preferences</h3><ProfileForm idPrefix="set" profile={profile} onChange={onProfile} /></div>
      </div>
      <div className="panel">
        <h3>Data source</h3>
        <label className="check"><input type="checkbox" checked={useSample} onChange={(e) => onSample(e.target.checked)} />Use clearly labelled sample data instead of live data</label>
        <p className="hint">Live data: Open-Meteo Air Quality API (Copernicus CAMS atmospheric model, not a ground monitor) and Open-Meteo weather. Responses are cached in this browser for 30 minutes.</p>
      </div>
      <div className="panel">
        <h3>Privacy and calculation assumptions</h3>
        <ul className="bullets">
          <li>No account, backend or database. Preferences, daily checklist, trip log and cached air data are stored only in this browser’s localStorage.</li>
          <li>No exact address is collected. Detected locations are rounded to about 1 km, used for the data request only and never saved.</li>
          <li>The optional AI key is kept in memory only. See the AI panel for exactly what is sent.</li>
          <li>AQI is computed with CPCB (India) breakpoints from modelled pollutant concentrations, using the worst sub-index. Official monitor readings may differ.</li>
        </ul>
        <button className="btn danger" onClick={() => setConfirm(true)}><RotateCcw size={18} aria-hidden="true" />Reset all saved data</button>
      </div>
      <Modal open={confirm} title="Reset saved data?" onClose={() => setConfirm(false)}>
        <p>This removes your preferences, progress, trip log and cached air data from this browser.</p>
        <div className="row">
          <button className="btn danger" onClick={() => { onReset(); setConfirm(false) }}>Yes, reset</button>
          <button className="btn secondary" onClick={() => setConfirm(false)}>Cancel</button>
        </div>
      </Modal>
    </div>
  )
}
