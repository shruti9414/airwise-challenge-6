import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import type { Place } from '../types'
import { type GeoResult, searchPlaces } from '../lib/airData'
import { useDebounced } from '../hooks'

const MIN_QUERY = 2
const round2 = (n: number) => Math.round(n * 100) / 100

/** Debounced search over any Indian city, with a live status region and a result list. */
export default function CitySearch({ idPrefix, onPlace }: { idPrefix: string; onPlace: (p: Place) => void }) {
  const [query, setQuery] = useState('')
  const debounced = useDebounced(query.trim(), 400)
  const [results, setResults] = useState<{ q: string; items: GeoResult[] | 'error' } | null>(null)

  useEffect(() => {
    if (debounced.length < MIN_QUERY) return
    const ctrl = new AbortController()
    searchPlaces(debounced, ctrl.signal)
      .then((items) => setResults({ q: debounced, items }))
      .catch(() => {
        if (!ctrl.signal.aborted) setResults({ q: debounced, items: 'error' })
      })
    return () => ctrl.abort()
  }, [debounced])

  const current = debounced.length >= MIN_QUERY && results?.q === debounced ? results.items : null

  const choose = (r: GeoResult) => {
    onPlace({ name: r.name, lat: round2(r.lat), lon: round2(r.lon), kind: 'city' })
    setQuery('')
  }

  return (
    <div className="field">
      <label htmlFor={`${idPrefix}-search`}>Search another Indian city</label>
      <div className="input-icon">
        <Search size={18} aria-hidden="true" />
        <input
          id={`${idPrefix}-search`}
          type="search"
          value={query}
          maxLength={60}
          autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
          aria-describedby={`${idPrefix}-search-status`}
        />
      </div>
      <div id={`${idPrefix}-search-status`} role="status" className="hint">
        {debounced.length >= MIN_QUERY && current === null && 'Searching…'}
        {current === 'error' && 'Search is unavailable right now. Pick a city from the list.'}
        {Array.isArray(current) && current.length === 0 && 'No matching Indian city found.'}
      </div>
      {Array.isArray(current) && current.length > 0 && (
        <ul className="results" aria-label="Search results">
          {current.map((r) => (
            <li key={`${r.lat},${r.lon}`}>
              <button type="button" className="link-btn" onClick={() => choose(r)}>
                {r.name}
                {r.admin && <span className="muted">, {r.admin}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
