import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

/**
 * Two projects:
 * - unit: pure logic, no network (runs in CI on every push)
 * - integration: real RLS/constraint tests against the hosted DEV Supabase project, using throwaway
 *   users created with the secret key from .env.test.local (local only until repo secrets exist)
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // The real package throws outside React's server runtime; tests call server helpers directly.
      "server-only": fileURLToPath(new URL("./tests/support/server-only.ts", import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          setupFiles: ["tests/integration/setup.ts"],
          testTimeout: 60_000,
          hookTimeout: 120_000,
          // The hosted project is reached over the internet; retry transient network failures.
          retry: 2,
          fileParallelism: false,
        },
      },
    ],
  },
})
