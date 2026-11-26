import { useEffect, useState } from 'react'
import { Logo } from './ui'

const NAV = [
  { id: 'overview', label: 'Overview' },
  { id: 'plan', label: 'My Daily Plan' },
  { id: 'indoor', label: 'Indoor Air' },
  { id: 'community', label: 'Community' },
  { id: 'settings', label: 'Settings' },
]

/** Lazy sections mount after the first paint, so they are observed again shortly afterwards. */
const LATE_OBSERVE_MS = 1500

/** Highlights the nav item of the section currently in view. */
function useActiveSection() {
  const [active, setActive] = useState('overview')
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((e) => e.isIntersecting)
        if (hit) setActive(hit.target.id)
      },
      { rootMargin: '-30% 0px -60% 0px' },
    )
    const observeSections = () =>
      NAV.forEach((n) => {
        const el = document.getElementById(n.id)
        if (el) observer.observe(el)
      })
    observeSections()
    const late = setTimeout(observeSections, LATE_OBSERVE_MS)
    return () => {
      observer.disconnect()
      clearTimeout(late)
    }
  }, [])
  return active
}

export default function TopBar() {
  const active = useActiveSection()
  return (
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
  )
}
