import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup, configure } from '@testing-library/react'

// Lazy-loaded sections and slow machines (or coverage instrumentation) need more than the 1 s default.
configure({ asyncUtilTimeout: 8000 })

afterEach(() => {
  cleanup()
  localStorage.clear()
})
