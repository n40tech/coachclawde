import { defineConfig, devices } from '@playwright/test'

// The smoke test (e2e/smoke.e2e.ts): a production build in demo mode, on a
// phone-sized Chromium. Runs in CI only, on merge to main and before each
// release: `npm run smoke`. Named *.e2e.ts so Vitest never picks it up.
const PORT = 4173

export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.e2e.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    ...devices['Pixel 7'],
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    env: { VITE_DEMO_DATA: 'true' },
    timeout: 180_000,
    reuseExistingServer: false,
  },
})
