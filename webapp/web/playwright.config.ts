import { defineConfig } from '@playwright/test'

// E2E tracer for the offline-first sync layer. Runs against the real built
// exe (embedded SPA); see e2e/globalSetup.ts. Local and on demand only.
export default defineConfig({
  testDir: './e2e',
  testMatch: '*.e2e.ts',
  globalSetup: './e2e/globalSetup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 60_000,
  use: {
    // Set by globalSetup once the exe is listening on a free port.
    baseURL: process.env.E2E_BASE_URL,
    serviceWorkers: 'allow',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})
