import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { useAirData, useSaved } from './hooks'
import { assess, type Context } from './lib/engine'
import { buildAlerts } from './lib/alerts'
import { dayKey } from './lib/impact'
import Overview from './components/Overview'
import Assistant from './components/Assistant'
import Routine from './components/Routine'
import IndoorAir from './components/IndoorAir'
import { Alternatives, ImpactTracker } from './components/Impact'
import { Logo, Section } from './components/ui'

const Community = lazy(() => import('./components/Community'))
const Settings = lazy(() => import('./components/Settings'))
const Sources = lazy(() => import('./components/Sources'))

const NAV = [
  { id: 'overview', label: 'Overview' },
  { id: 'plan', label: 'My Daily Plan' },
  { id: 'indoor', label: 'Indoor Air' },
  { id: 'community', label: 'Community' },
  { id: 'settings', label: 'Settings' },
]

function useActiveSection() {
  const [active, setActive] = useState('overview')
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((e) => e.isIntersecting)
        if (hit) setActive(hit.target.id)
      },
      { rootMargin: '-30% 0px -60% 0px' },
    )
    NAV.forEach((n) => {
      const el = document.getElementById(n.id)
      if (el) obs.observe(el)
    })
    const late = setTimeout(
      () =>
        NAV.forEach((n) => {
          const el = document.getElementById(n.id)
          if (el) obs.observe(el)
        }),
      1500,
    )
    return () => {
      obs.disconnect()
      clearTimeout(late)
    }
  }, [])
  return active
}

export default function App() {
  const { saved, update, reset } = useSaved()
  const { state, reload } = useAirData(saved.place, saved.useSample)
  const active = useActiveSection()
  const data = state.status === 'ready' ? state.data : null

  const ctx: Context | null = useMemo(() => (data ? assess(data, saved.profile) : null), [data, saved.profile])
  const alerts = useMemo(() => (ctx ? buildAlerts(ctx) : []), [ctx])

  const today = dayKey()
  const list = {
    done: saved.done[today] ?? [],
    toggle: (id: string) => {
      const cur = saved.done[today] ?? []
      update({ done: { ...saved.done, [today]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] } })
    },
  }

  return (
    <>
      <a href="#main" className="skip">
        Skip to content
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <a href="#overview" className="brand" aria-label="AirWise home">
            <Logo />
          </a>
          <nav aria-label="Main">
            <ul>
              {NAV.map((n) => (
                <li key={n.id}>
                  <a href={`#${n.id}`} aria-current={active === n.id ? 'true' : undefined}>
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main id="main">
        <h1 className="sr-only">AirWise: urban air quality assistant for families</h1>
        <Section id="overview" eyebrow="Breathe Better, Live Smarter" title="Air quality around you">
          <Overview
            state={state}
            place={saved.place}
            reading={ctx?.reading ?? null}
            data={data}
            alerts={alerts}
            profile={saved.profile}
            onPlace={(place) => update({ place, useSample: false })}
            onRetry={reload}
            onUseSample={() => update({ useSample: true })}
          />
          <h3 className="sub-h">Smart family assistant</h3>
          <Assistant ctx={ctx} onProfile={(profile) => update({ profile })} />
        </Section>
        <Section
          id="plan"
          eyebrow="My Daily Plan"
          title="Your day, planned around the air"
          intro="Time-based actions with a reason for each. Tick them off as you go."
        >
          <Routine ctx={ctx} list={list} />
          <h3 className="sub-h">Sustainable daily alternatives</h3>
          <Alternatives profile={saved.profile} band={ctx?.reading.band ?? null} />
          <h3 className="sub-h">Personal impact tracker</h3>
          <ImpactTracker done={saved.done} trips={saved.trips} onTrips={(trips) => update({ trips })} />
        </Section>
        <Section
          id="indoor"
          eyebrow="Indoor Air"
          title="Cleaner air at home"
          intro="Practical steps, with honest limits on what each one can do."
        >
          <IndoorAir ctx={ctx} list={list} />
        </Section>
        <Suspense
          fallback={
            <div id="community" className="section">
              Loading…
            </div>
          }
        >
          <Section id="community" eyebrow="Community" title="Clean air is a team effort">
            <Community saved={saved} onChange={update} />
          </Section>
        </Suspense>
        <Suspense
          fallback={
            <div id="settings" className="section">
              Loading…
            </div>
          }
        >
          <Section id="settings" eyebrow="Settings" title="Preferences, data and privacy">
            <Settings
              place={saved.place}
              profile={saved.profile}
              useSample={saved.useSample}
              onPlace={(place) => update({ place, useSample: false })}
              onProfile={(profile) => update({ profile })}
              onSample={(useSample) => update({ useSample })}
              onReset={reset}
            />
          </Section>
          <Section id="sources" eyebrow="Sources and disclaimer" title="Where the guidance comes from">
            <Sources />
          </Section>
        </Suspense>
      </main>
      <footer className="footer">
        <p>AirWise · general awareness guidance, not medical advice · no account, backend or database.</p>
      </footer>
    </>
  )
}
