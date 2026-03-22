import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'

/**
 * E2E en navegador contra Vite (proxy `/api` → backend en 127.0.0.1:8000).
 * La API y Postgres deben estar ya en marcha (no los arranca Playwright).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : [['list'], ['html', { open: 'never' }]],
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    // `npm run dev` puede tardar más en Windows al invocar npm; Vite directo es más fiable para el runner.
    command: 'npx vite --host 127.0.0.1 --port 5173',
    url: baseURL,
    reuseExistingServer: process.env.CI !== '1' && process.env.CI !== 'true',
    timeout: 180_000,
  },
})
