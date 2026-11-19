import { defineConfig, devices } from "@playwright/test"

import "./tests/support/load-env"

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000"

/**
 * E2E tests run against the dev server and the hosted DEV Supabase project.
 * A throwaway user is created in global.setup and deleted in global.teardown.
 * Locally the installed Chrome is used (no browser download); CI uses Playwright's Chromium.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /global\.setup\.ts/, teardown: "teardown" },
    { name: "teardown", testMatch: /global\.teardown\.ts/ },
    {
      name: "chrome",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.CI ? undefined : (process.env.PW_CHANNEL ?? "chrome"),
      },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: `${baseURL}/login`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
})
