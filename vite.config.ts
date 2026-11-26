/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['src/test-setup.ts'],
    testTimeout: 20000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/testData.ts', 'src/test-setup.ts', 'src/main.tsx'],
      // Fails `npm run test:coverage` if coverage drops below these floors.
      thresholds: { statements: 95, branches: 88, functions: 92, lines: 96 },
    },
  },
})
