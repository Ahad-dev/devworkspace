import { existsSync } from "node:fs"
import { join } from "node:path"

/**
 * Loads .env.local (public app config) and then .env.test.local (test-only secrets) into process.env.
 * process.loadEnvFile never overrides variables that are already set, so CI secrets win.
 */
// Test runners (vitest, playwright) always start in the repo root. Not import.meta: Playwright
// compiles this file as CommonJS.
const root = process.cwd()
for (const file of [".env.local", ".env.test.local"]) {
  const path = join(root, file)
  if (existsSync(path)) process.loadEnvFile(path)
}
