import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // Electron + real SQLite/IPC round-trips are genuinely slower under CI's shared,
  // often 2-core runners than on a dev machine - 30s left almost no margin for the
  // heavier (multi-image) tests, causing real (not flaky-assertion) timeouts.
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']]
})
