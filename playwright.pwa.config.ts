import { defineConfig, devices } from "@playwright/test"

import "./tests/support/load-env"

const port = Number(process.env.PWA_PORT ?? 3100)
const baseURL = `http://localhost:${port}`

/**
 * PWA and offline tests (Plan P9.5): service workers only run in production builds, so these use
 * `next build && next start` on their own port. Not 3000: a worker left on localhost:3000 would
 * serve stale build files to `pnpm dev`. Throwaway users only, created and deleted by the spec.
 */
export default defineConfig({
  testDir: "tests/pwa",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    serviceWorkers: "allow",
    ...devices["Desktop Chrome"],
    channel: process.env.CI ? undefined : (process.env.PW_CHANNEL ?? "chrome"),
  },
  webServer: {
    command: `pnpm build && pnpm start --port ${port}`,
    url: `${baseURL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 600_000,
  },
})
