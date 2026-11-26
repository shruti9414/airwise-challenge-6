import { useState } from 'react'
import type { Profile } from '../types'
import { OPTIONS, parseFamilySize } from '../lib/storage'

const LABELS = {
  activity: {
    minimal: 'Mostly indoors',
    walking: 'Daily walks / errands',
    exercise: 'Regular outdoor exercise',
    outdoorWork: 'Outdoor work or play',
  },
  commute: {
    car: 'Personal car',
    twoWheeler: 'Two-wheeler',
    publicTransport: 'Public transport',
    walkCycle: 'Walk or cycle',
    remote: 'Work/study from home',
  },
  ventilation: { openable: 'Windows open easily', limited: 'Limited ventilation', acOnly: 'Sealed / AC only' },
}

function Select<K extends 'activity' | 'commute' | 'ventilation'>({
  id,
  name,
  text,
  profile,
  onChange,
}: {
  id: string
  name: K
  text: string
  profile: Profile
  onChange: (p: Profile) => void
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{text}</label>
      <select id={id} value={profile[name]} onChange={(e) => onChange({ ...profile, [name]: e.target.value })}>
        {OPTIONS[name].map((o) => (
          <option key={o} value={o}>
            {(LABELS[name] as Record<string, string>)[o]}
          </option>
        ))}
      </select>
    </div>
  )
}

export function ProfileForm({
  idPrefix,
  profile,
  onChange,
}: {
  idPrefix: string
  profile: Profile
  onChange: (p: Profile) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const parsed = draft === null ? null : parseFamilySize(draft)
  const error = parsed && 'error' in parsed ? parsed.error : ''
  const checks: { key: 'children' | 'elderly' | 'respiratory' | 'purifier'; text: string }[] = [
    { key: 'children', text: 'Children at home' },
    { key: 'elderly', text: 'Older adults at home' },
    { key: 'respiratory', text: 'Someone with respiratory sensitivity' },
    { key: 'purifier', text: 'Air purifier available' },
  ]
  return (
    <form className="form-grid" onSubmit={(e) => e.preventDefault()} noValidate>
      <div className="field">
        <label htmlFor={`${idPrefix}-size`}>Family size</label>
        <input
          id={`${idPrefix}-size`}
          inputMode="numeric"
          value={draft ?? String(profile.familySize)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${idPrefix}-size-err` : undefined}
          onChange={(e) => {
            setDraft(e.target.value)
            const r = parseFamilySize(e.target.value)
            if ('value' in r) onChange({ ...profile, familySize: r.value })
          }}
          onBlur={() => setDraft(null)}
        />
        {error && (
          <p id={`${idPrefix}-size-err`} className="error" role="alert">
            {error}
          </p>
        )}
      </div>
      <Select
        id={`${idPrefix}-act`}
        name="activity"
        text="Daily outdoor activity"
        profile={profile}
        onChange={onChange}
      />
      <Select id={`${idPrefix}-com`} name="commute" text="Main commute" profile={profile} onChange={onChange} />
      <Select
        id={`${idPrefix}-vent`}
        name="ventilation"
        text="Home ventilation"
        profile={profile}
        onChange={onChange}
      />
      <fieldset className="checks">
        <legend>Household</legend>
        {checks.map((c) => (
          <label key={c.key} className="check">
            <input
              type="checkbox"
              checked={profile[c.key]}
              onChange={(e) => onChange({ ...profile, [c.key]: e.target.checked })}
            />
            {c.text}
          </label>
        ))}
      </fieldset>
    </form>
  )
}
