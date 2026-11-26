import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { STORAGE_KEY } from './lib/storage'

const seed = (extra: object = {}) => localStorage.setItem(STORAGE_KEY, JSON.stringify({ useSample: true, ...extra }))
const setup = () => ({ user: userEvent.setup(), ...render(<App />) })

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new Event('close')) }
})
afterEach(() => vi.unstubAllGlobals())

describe('single-page navigation and states', () => {
  it('renders every nav destination as a working in-page link and a clear sample label', async () => {
    seed()
    setup()
    const nav = screen.getByRole('navigation', { name: 'Main' })
    for (const [label, id] of [['Overview', 'overview'], ['My Daily Plan', 'plan'], ['Indoor Air', 'indoor'], ['Community', 'community'], ['Settings', 'settings']]) {
      expect(within(nav).getByRole('link', { name: label })).toHaveAttribute('href', `#${id}`)
    }
    expect(screen.getAllByText(/not a live reading/i).length).toBeGreaterThan(0)
    expect(await screen.findByRole('heading', { name: /Clean air is a team effort/ })).toBeInTheDocument()
  })

  it('has a skip link as the first focusable element and keyboard-reachable nav', async () => {
    seed()
    const { user } = setup()
    await user.tab()
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveFocus()
    await user.tab()
    await user.tab()
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveFocus()
  })

  it('shows a loading state, then an error state with retry and sample fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const { user } = setup()
    expect(screen.getByText(/Loading air-quality data/)).toBeInTheDocument()
    expect(await screen.findByText(/Live data is unavailable/)).toBeInTheDocument()
    expect(screen.getAllByText(/appears once air-quality data is available/i).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: /View sample data instead/ }))
    expect(screen.getAllByText(/Sample data/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Live data is unavailable/)).not.toBeInTheDocument()
  })
})

describe('personalisation', () => {
  it('changes the recommendation when the household changes', async () => {
    seed()
    const { user } = setup()
    const before = document.querySelector('.assistant .advice')!.textContent
    await user.click(screen.getAllByLabelText('Older adults at home')[0] as HTMLElement)
    const after = document.querySelector('.assistant .advice')!.textContent
    expect(after).not.toBe(before)
    expect(after).toMatch(/older/i)
  })

  it('validates family size and links the error to the field', async () => {
    seed()
    const { user } = setup()
    const input = screen.getAllByLabelText('Family size')[0] as HTMLInputElement
    await user.clear(input)
    await user.type(input, '40')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    const msg = screen.getAllByRole('alert').find((e) => /between 1 and 12/.test(e.textContent ?? ''))!
    expect(input.getAttribute('aria-describedby')).toBe(msg.id)
    await user.clear(input)
    await user.type(input, '5')
    expect(input).not.toHaveAttribute('aria-invalid')
  })
})

describe('daily plan, indoor air, impact', () => {
  it('tracks routine completion and persists it', async () => {
    seed()
    const { user } = setup()
    const progress = screen.getByRole('progressbar')
    const first = within(screen.getByRole('article', { name: /Morning/ })).getAllByRole('checkbox')[0] as HTMLElement
    await user.click(first)
    expect(first).toBeChecked()
    expect(progress).toHaveValue(1)
    expect(localStorage.getItem(STORAGE_KEY)).toMatch(/"done":\{"\d{4}-\d{2}-\d{2}":\["/)
  })

  it('opens an indoor hack with all required facts', async () => {
    seed()
    const { user } = setup()
    await user.click(screen.getByText('Use a HEPA purifier sized for the room'))
    for (const t of ['What to do', 'Why it helps', 'Difficulty', 'Estimated cost', 'Expected benefit', 'Limitations']) {
      expect(screen.getAllByText(t).length).toBeGreaterThan(0)
    }
  })

  it('logs a trip with validation, updates the tracker and deletes it', async () => {
    seed()
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: /Add trip/ }))
    expect(screen.getByText(/Enter the distance/)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Distance (km)'), '10')
    await user.click(screen.getByRole('button', { name: /Add trip/ }))
    expect(screen.getByText(/Public transport · 10 km/)).toBeInTheDocument()
    expect(screen.getByText('Low-emission trips').nextSibling).toHaveTextContent('1')
    expect(screen.getByText(/Est. CO₂e avoided/).nextSibling).toHaveTextContent('1 kg')
    await user.click(screen.getByRole('button', { name: /Delete trip/ }))
    expect(screen.getByText(/No trips logged yet/)).toBeInTheDocument()
  })
})

describe('community and settings', () => {
  it('joins a challenge and ticks the checklist', async () => {
    seed()
    const { user } = setup()
    const join = (await screen.findAllByRole('button', { name: 'Join challenge' }))[0] as HTMLElement
    await user.click(join)
    expect(join).toHaveAccessibleName('Leave challenge')
    expect(join).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByLabelText('No open burning of waste or leaves'))
    expect(screen.getByText('1 of 8 complete.')).toBeInTheDocument()
  })

  it('resets all saved data after confirmation', async () => {
    seed({ joined: ['car-light'], profile: { elderly: true } })
    const { user } = setup()
    await user.click(await screen.findByRole('button', { name: /Reset all saved data/ }))
    await user.click(screen.getByRole('button', { name: 'Yes, reset' }))
    expect(localStorage.getItem(STORAGE_KEY)).not.toMatch(/car-light/)
    expect((await screen.findAllByLabelText('Older adults at home'))[0]).not.toBeChecked()
  })

  it('switches between sample and live data from settings', async () => {
    seed()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const { user } = setup()
    await user.click(await screen.findByLabelText(/Use clearly labelled sample data/))
    expect(await screen.findByText(/Live data is unavailable/)).toBeInTheDocument()
  })
})

describe('optional Gemini integration', () => {
  const generate = async (user: ReturnType<typeof userEvent.setup>) => {
    const btn = screen.getByRole('button', { name: /Generate full AI advice/ })
    expect(btn).toBeDisabled()
    await user.type(screen.getByLabelText('Gemini API key'), 'k'.repeat(30))
    expect(btn).toBeDisabled()
    await user.click(screen.getByLabelText(/I understand this summary and my question/))
    await user.click(btn)
  }

  it('labels validated AI output separately from rule-based advice and sends no location', async () => {
    seed()
    const body = { analysis: 'Poor air today.', meaning: 'Sensitive people may feel it.', doNow: ['Stay in'], avoid: ['Running'], alternatives: ['Yoga'], why: 'Fine particles reach the lungs.' }
    const f = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] } }] }) })
    vi.stubGlobal('fetch', f)
    const { user } = setup()
    expect(screen.getByText(/Rule-based advice/)).toBeInTheDocument()
    await generate(user)
    expect(await screen.findByText(/AI-generated by Gemini/)).toBeInTheDocument()
    const [url, init] = f.mock.calls[0] as [string, RequestInit]
    expect(url).not.toContain('key=')
    expect(init.body as string).not.toMatch(/Delhi|28\.6|familySize/)
    expect(localStorage.getItem(STORAGE_KEY)).not.toContain('kkkk')
    await user.click(screen.getByRole('button', { name: /Clear key/ }))
    expect(screen.getByLabelText('Gemini API key')).toHaveValue('')
  })

  it('shows a safe fallback message when the AI call fails', async () => {
    seed()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }))
    const { user } = setup()
    await generate(user)
    expect(await screen.findByText(/API key was rejected/)).toBeInTheDocument()
    expect(screen.queryByText(/AI-generated by Gemini/)).not.toBeInTheDocument()
  })
})

describe('use my location', () => {
  const stubGeo = (impl: (ok: PositionCallback, fail: PositionErrorCallback, opts?: PositionOptions) => void) => {
    const getCurrentPosition = vi.fn(impl)
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } })
    return getCurrentPosition
  }
  const locate = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getAllByRole('button', { name: /Use my location/ })[0]!)
    await user.click(screen.getByRole('button', { name: 'Continue' }))
  }

  it('asks for a fresh high-accuracy position and names it after the nearest preset city', async () => {
    seed()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const get = stubGeo((ok) => ok({ coords: { latitude: 28.7041, longitude: 77.1025 } } as GeolocationPosition))
    const { user } = setup()
    await locate(user)
    expect((await screen.findAllByText('Near Delhi (approx.)')).length).toBeGreaterThan(0)
    expect(get.mock.calls[0]![2]).toMatchObject({ enableHighAccuracy: true, maximumAge: 0 })
  })

  it('names the place from the reverse-geocoding lookup and sends only rounded coordinates', async () => {
    seed()
    const f = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ address: { state_district: 'Surat', state: 'Gujarat', county: 'Majura Taluka' } }) })
    vi.stubGlobal('fetch', f)
    stubGeo((ok) => ok({ coords: { latitude: 21.17021, longitude: 72.83114 } } as GeolocationPosition))
    const { user } = setup()
    await locate(user)
    expect((await screen.findAllByText('Surat, Gujarat (approx.)')).length).toBeGreaterThan(0)
    const url = String((f.mock.calls.find(([u]) => String(u).includes('nominatim')) as [string])[0])
    expect(url).toContain('lat=21.17&lon=72.83')
    expect(url).not.toContain('21.17021')
  })

  it.each([
    [1, /permission was denied/], [2, /could not work out its location/], [3, /took too long/],
  ])('explains geolocation error code %i specifically', async (code, message) => {
    seed()
    stubGeo((_ok, fail) => fail({ code, message: '' } as GeolocationPositionError))
    const { user } = setup()
    await locate(user)
    expect(await screen.findByText(message)).toBeInTheDocument()
  })
})

describe('keyless chat', () => {
  it('answers a question with no key and makes no network call', async () => {
    seed()
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    const { user } = setup()
    await user.type(screen.getByLabelText('Your question'), 'How can I clean the air in my bedroom?')
    await user.click(screen.getByRole('button', { name: /Get instant answer/ }))
    expect(await screen.findByText(/Rule-based answer/)).toBeInTheDocument()
    expect(screen.getByText(/You asked:/)).toBeInTheDocument()
    expect(f).not.toHaveBeenCalled()
  })

  it('still blocks contact details without a key', async () => {
    seed()
    const { user } = setup()
    await user.type(screen.getByLabelText('Your question'), 'call me 9876543210 about air')
    await user.click(screen.getByRole('button', { name: /Get instant answer/ }))
    expect(await screen.findByText(/Remove emails/)).toBeInTheDocument()
  })
})

describe('Gemini chat box', () => {
  const reply = (body: object) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] } }] }) })
  const unlock = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByLabelText('Gemini API key'), 'k'.repeat(30))
    await user.click(screen.getByLabelText(/I understand this summary and my question/))
  }

  it('keeps Ask disabled until a key and consent are given, then shows a labelled, validated answer', async () => {
    seed()
    const f = vi.fn().mockResolvedValue(reply({ answer: 'Keep windows closed today.', steps: ['Run a purifier'] }))
    vi.stubGlobal('fetch', f)
    const { user } = setup()
    const ask = screen.getByRole('button', { name: /Ask Gemini/ })
    expect(ask).toBeDisabled()
    await unlock(user)
    expect(ask).toBeEnabled()
    await user.click(screen.getByRole('button', { name: /safe to send my child to school/ }))
    expect(screen.getByLabelText('Your question')).toHaveValue('Is it safe to send my child to school today?')
    await user.click(ask)
    expect(await screen.findByText(/Keep windows closed today/)).toBeInTheDocument()
    expect(screen.getByText(/You asked:/)).toBeInTheDocument()
    expect(screen.getByText(/AI-generated by Gemini/)).toBeInTheDocument()
    const sent = (f.mock.calls[0] as [string, RequestInit])[1].body as string
    expect(sent).toContain('safe to send my child to school')
    expect(sent).not.toMatch(/Delhi|28.6|familySize/)
    expect(screen.getByLabelText('Your question')).toHaveValue('')
  })

  it('blocks questions containing contact details and links the error to the field', async () => {
    seed()
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    const { user } = setup()
    await unlock(user)
    const box = screen.getByLabelText('Your question')
    await user.type(box, 'my email is a@b.com, is air ok?')
    await user.click(screen.getByRole('button', { name: /Ask Gemini/ }))
    const err = await screen.findByText(/Remove emails/)
    expect(box).toHaveAttribute('aria-invalid', 'true')
    expect(box.getAttribute('aria-describedby')).toContain(err.id)
    expect(f).not.toHaveBeenCalled()
  })

  it('shows a fallback message when the AI call fails, and discards unsafe output', async () => {
    seed()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(reply({ answer: '<script>x</script>', steps: [] })).mockResolvedValueOnce({ ok: false, status: 403 }))
    const { user } = setup()
    await unlock(user)
    await user.type(screen.getByLabelText('Your question'), 'Is it safe outside now?')
    await user.click(screen.getByRole('button', { name: /Ask Gemini/ }))
    expect(await screen.findByText(/failed safety validation/)).toBeInTheDocument()
    expect(screen.queryByText(/script/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Ask Gemini/ }))
    expect(await screen.findByText(/API key was rejected/)).toBeInTheDocument()
  })
})
