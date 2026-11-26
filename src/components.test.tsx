import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import type { Place, Profile } from './types'
import { flatData, profile } from './testData'
import { assess } from './lib/engine'
import { CITIES, DEFAULT_PROFILE } from './lib/storage'
import App from './App'
import { STORAGE_KEY } from './lib/storage'
import CitySearch from './components/CitySearch'
import PollutantList from './components/PollutantList'
import ReadingSummary from './components/ReadingSummary'
import IndoorAir from './components/IndoorAir'
import LocationPicker from './components/LocationPicker'
import { ProfileForm } from './components/ProfileForm'
import TopBar from './components/TopBar'
import { AdviceView, Modal } from './components/ui'

afterEach(() => vi.unstubAllGlobals())

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response
const setup = () => userEvent.setup()

describe('CitySearch', () => {
  const surat = { name: 'Surat', latitude: 21.17, longitude: 72.83, admin1: 'Gujarat' }

  it('searches after a pause, lists results and picks a rounded place', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ results: [surat] })))
    const onPlace = vi.fn()
    const user = setup()
    render(<CitySearch idPrefix="t" onPlace={onPlace} />)
    await user.type(screen.getByLabelText('Search another Indian city'), 'Sur')
    expect(await screen.findByRole('button', { name: /Surat/ })).toBeInTheDocument()
    expect(screen.getByText(/Gujarat/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Surat/ }))
    expect(onPlace).toHaveBeenCalledWith({ name: 'Surat', lat: 21.17, lon: 72.83, kind: 'city' })
    expect(screen.getByLabelText('Search another Indian city')).toHaveValue('')
  })

  it('says so when nothing matches or the service is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ results: [] })))
    const user = setup()
    const { unmount } = render(<CitySearch idPrefix="t" onPlace={vi.fn()} />)
    await user.type(screen.getByLabelText('Search another Indian city'), 'zzzz')
    expect(await screen.findByText('No matching Indian city found.')).toBeInTheDocument()
    unmount()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    render(<CitySearch idPrefix="t" onPlace={vi.fn()} />)
    await user.type(screen.getByLabelText('Search another Indian city'), 'Pune')
    expect(await screen.findByText(/Search is unavailable/)).toBeInTheDocument()
  })

  it('does not search for a single character', async () => {
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    const user = setup()
    render(<CitySearch idPrefix="t" onPlace={vi.fn()} />)
    await user.type(screen.getByLabelText('Search another Indian city'), 'S')
    await act(() => new Promise((r) => setTimeout(r, 600)))
    expect(f).not.toHaveBeenCalled()
  })
})

describe('LocationPicker', () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '')
    }
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    }
  })

  it('switches to a preset city from the list', async () => {
    const onPlace = vi.fn()
    render(<LocationPicker idPrefix="l" place={CITIES[1] as Place} onPlace={onPlace} />)
    await setup().selectOptions(screen.getByLabelText('City'), 'Mumbai')
    expect(onPlace).toHaveBeenCalledWith(CITIES.find((c) => c.name === 'Mumbai'))
  })

  it('shows a detected place as its own option and closes the consent dialog on "Not now"', async () => {
    const geo: Place = { name: 'Surat, Gujarat (approx.)', lat: 21.17, lon: 72.83, kind: 'geo' }
    const user = setup()
    render(<LocationPicker idPrefix="l" place={geo} onPlace={vi.fn()} />)
    expect(within(screen.getByLabelText('City')).getByRole('option', { name: geo.name })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Use my location/ }))
    expect(screen.getByRole('dialog')).toHaveAttribute('open')
    await user.click(screen.getByRole('button', { name: 'Not now' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('reports a browser without geolocation support', async () => {
    vi.stubGlobal('navigator', { ...navigator, geolocation: undefined })
    const user = setup()
    render(<LocationPicker idPrefix="l" place={CITIES[1] as Place} onPlace={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /Use my location/ }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByText(/does not support location access/)).toBeInTheDocument()
  })
})

describe('TopBar', () => {
  let trigger: (entries: Partial<IntersectionObserverEntry>[]) => void = () => {}

  it('marks the section in view as current', () => {
    class FakeObserver {
      constructor(cb: IntersectionObserverCallback) {
        trigger = (entries) => cb(entries as IntersectionObserverEntry[], this as unknown as IntersectionObserver)
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    render(<TopBar />)
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'true')
    act(() => trigger([{ isIntersecting: true, target: { id: 'indoor' } as Element }]))
    expect(screen.getByRole('link', { name: 'Indoor Air' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current')
    act(() => trigger([{ isIntersecting: false, target: { id: 'settings' } as Element }]))
    expect(screen.getByRole('link', { name: 'Indoor Air' })).toHaveAttribute('aria-current', 'true')
  })

  it('still renders every link when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    render(<TopBar />)
    expect(within(screen.getByRole('navigation', { name: 'Main' })).getAllByRole('link')).toHaveLength(5)
  })
})

describe('ProfileForm', () => {
  function Harness({ initial = DEFAULT_PROFILE }: { initial?: Profile }) {
    const [p, setP] = useState(initial)
    return (
      <>
        <ProfileForm idPrefix="p" profile={p} onChange={setP} />
        <output data-testid="out">{JSON.stringify(p)}</output>
      </>
    )
  }
  const state = () => JSON.parse(screen.getByTestId('out').textContent ?? '{}') as Profile

  it('accepts a valid family size and rejects an invalid one with a linked, announced error', async () => {
    const user = setup()
    render(<Harness />)
    const size = screen.getByLabelText('Family size')
    await user.clear(size)
    await user.type(size, '6')
    expect(state().familySize).toBe(6)
    await user.clear(size)
    await user.type(size, '99')
    const error = await screen.findByRole('alert')
    expect(error).toHaveTextContent(/between 1 and 12/)
    expect(size).toHaveAttribute('aria-invalid', 'true')
    expect(size.getAttribute('aria-describedby')).toBe(error.id)
    // the first keystroke (9) was a valid size and stays saved; the invalid 99 is not applied
    expect(state().familySize).toBe(9)
    fireEvent.blur(size)
    expect(size).toHaveValue('9')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('updates household checkboxes and lifestyle selects', async () => {
    const user = setup()
    render(<Harness />)
    await user.click(screen.getByLabelText('Children at home'))
    await user.click(screen.getByLabelText('Air purifier available'))
    await user.selectOptions(screen.getByLabelText('Main commute'), 'remote')
    await user.selectOptions(screen.getByLabelText('Home ventilation'), 'acOnly')
    await user.selectOptions(screen.getByLabelText('Daily outdoor activity'), 'exercise')
    expect(state()).toMatchObject({
      children: true,
      purifier: true,
      commute: 'remote',
      ventilation: 'acOnly',
      activity: 'exercise',
    })
  })
})

describe('IndoorAir window verdict', () => {
  const list = { done: [] as string[], toggle: vi.fn() }
  const verdict = (pm25: number, p: Partial<Profile> = {}) => {
    const { unmount } = render(<IndoorAir ctx={assess(flatData(pm25), profile(p))} list={list} />)
    const text = document.querySelector('.verdict')?.textContent
    unmount()
    return text
  }

  it('gives a different verdict for clean, moderate, poor and sealed homes', () => {
    expect(verdict(10)).toBe('Open now')
    expect(verdict(75)).toBe('Briefly, if needed')
    expect(verdict(150)).toBe('Keep closed')
    expect(verdict(10, { ventilation: 'acOnly' })).toBe('Not applicable')
  })

  it('does not advise on windows without particulate data', () => {
    const data = flatData(50)
    data.hourly = data.hourly.map((h) => ({ ...h, pm25: null, pm10: null }))
    render(<IndoorAir ctx={assess(data, profile())} list={list} />)
    expect(document.querySelector('.verdict')?.textContent).toBe('Unknown')
  })

  it('asks for data when there is no context, and toggles a hack on request', async () => {
    const { unmount } = render(<IndoorAir ctx={null} list={list} />)
    expect(screen.getByText(/appears once air-quality data is available/)).toBeInTheDocument()
    unmount()
    render(<IndoorAir ctx={assess(flatData(150), profile())} list={list} />)
    await setup().click(screen.getAllByLabelText(/I did this today/)[0] as HTMLElement)
    expect(list.toggle).toHaveBeenCalledTimes(1)
  })
})

describe('shared UI pieces', () => {
  it('shows a placeholder for an advice section with nothing to say', () => {
    render(<AdviceView advice={{ analysis: 'a', meaning: 'm', doNow: [], avoid: [], alternatives: [], why: 'w' }} />)
    expect(screen.getAllByText('Nothing specific right now.')).toHaveLength(3)
  })

  it('opens and closes a dialog even where showModal and close are missing', () => {
    const { rerender } = render(
      <Modal open={false} title="Hello" onClose={vi.fn()}>
        <p>body</p>
      </Modal>,
    )
    const dialog = document.querySelector('dialog') as HTMLDialogElement
    expect(dialog).not.toHaveAttribute('open')
    rerender(
      <Modal open title="Hello" onClose={vi.fn()}>
        <p>body</p>
      </Modal>,
    )
    expect(dialog).toHaveAttribute('open')
    expect(screen.getByRole('heading', { name: 'Hello' })).toBeInTheDocument()
    rerender(
      <Modal open={false} title="Hello" onClose={vi.fn()}>
        <p>body</p>
      </Modal>,
    )
    expect(dialog).not.toHaveAttribute('open')
  })
})

describe('missing-data states', () => {
  const noParticulates = () => {
    const data = flatData(50)
    data.hourly = data.hourly.map((h) => ({ ...h, pm25: null, pm10: null }))
    return { data, ctx: assess(data, profile()) }
  }

  it('says clearly that no AQI can be estimated, instead of showing a number', () => {
    const { data, ctx } = noParticulates()
    render(<ReadingSummary reading={ctx.reading} data={data} guidance={null} />)
    expect(screen.getByText(/not enough valid pollutant data/)).toBeInTheDocument()
    expect(screen.getByLabelText('AQI unavailable')).toBeInTheDocument()
    // the category badge and the main-pollutant field both read "Unavailable"
    expect(screen.getAllByText('Unavailable')).toHaveLength(2)
  })

  it('marks pollutants without enough valid hours as n/a', () => {
    const { ctx } = noParticulates()
    render(<PollutantList reading={ctx.reading} />)
    expect(screen.getAllByText('n/a').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThanOrEqual(2)
  })
})

describe('settings interactions', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '')
    }
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    }
  })

  it('lets the user change city, switch off sample data and cancel a reset', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ useSample: true }))
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const user = setup()
    render(<App />)
    await screen.findByRole('heading', { name: /Preferences, data and privacy/ })

    await user.click(screen.getByLabelText(/Use clearly labelled sample data/))
    expect(await screen.findByText(/Live data is unavailable/)).toBeInTheDocument()

    await user.selectOptions(screen.getAllByLabelText('City')[1] as HTMLElement, 'Mumbai')
    expect(screen.getAllByText('Mumbai').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: /Reset all saved data/ }))
    expect(screen.getByRole('dialog', { name: 'Reset saved data?' })).toHaveAttribute('open')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog', { name: 'Reset saved data?' })).not.toBeInTheDocument()
  })
})
