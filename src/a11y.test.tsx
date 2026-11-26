import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import axe from 'axe-core'
import App from './App'
import { STORAGE_KEY } from './lib/storage'

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
})

/** Colour contrast needs real layout, so it is excluded here and checked separately in a browser. */
const scan = async (container: HTMLElement) => {
  const r = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
}

describe('automated accessibility checks (axe-core)', () => {
  it('finds no violations on the full page with sample data, including lazy sections', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ useSample: true }))
    const { container } = render(<App />)
    await screen.findByRole('heading', { name: /Clean air is a team effort/ })
    await screen.findByRole('heading', { name: /Preferences, data and privacy/ })
    expect(await scan(container)).toEqual([])
  })

  it('has exactly one level-one heading', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ useSample: true }))
    render(<App />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('finds no violations in the error state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const { container } = render(<App />)
    await screen.findByText(/Live data is unavailable/)
    expect(await scan(container)).toEqual([])
    vi.unstubAllGlobals()
  })
})
