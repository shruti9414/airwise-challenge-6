import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AirData, Place, Saved } from './types'
import { loadLive, sampleData } from './lib/airData'
import { DEFAULT_SAVED, clearAllSaved, loadSaved, persist } from './lib/storage'

export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export function useSaved() {
  const [saved, setSaved] = useState<Saved>(loadSaved)
  useEffect(() => persist(saved), [saved])
  const update = useCallback((patch: Partial<Saved>) => setSaved((s) => ({ ...s, ...patch })), [])
  const reset = useCallback(() => {
    clearAllSaved()
    setSaved(DEFAULT_SAVED)
  }, [])
  return { saved, update, reset }
}

export type AirState =
  { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: AirData; fromCache: boolean }

type Result = { key: string; state: AirState }

export function useAirData(place: Place, useSample: boolean) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const key = `${place.lat},${place.lon},${attempt}`
  const sample = useMemo(() => (useSample ? sampleData() : null), [useSample])

  useEffect(() => {
    if (useSample) return
    const ctrl = new AbortController()
    loadLive(place, ctrl.signal)
      .then(({ data, fromCache }) => setResult({ key, state: { status: 'ready', data, fromCache } }))
      .catch((e: unknown) => {
        if (!ctrl.signal.aborted)
          setResult({
            key,
            state: { status: 'error', message: e instanceof Error ? e.message : 'Could not load data.' },
          })
      })
    return () => ctrl.abort()
  }, [key, place, useSample])

  const state: AirState = sample
    ? { status: 'ready', data: sample, fromCache: false }
    : result?.key === key
      ? result.state
      : { status: 'loading' }
  return { state, reload: useCallback(() => setAttempt((n) => n + 1), []) }
}
