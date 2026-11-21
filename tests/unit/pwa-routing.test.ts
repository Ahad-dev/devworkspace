import {
  unstable_doesMiddlewareMatch,
  unstable_getResponseFromNextConfig,
} from "next/experimental/testing/server"
import { describe, expect, it, vi } from "vitest"

import nextConfig from "../../next.config"
import { config } from "@/proxy"

// The proxy's session code reads env at import; only its matcher is under test here.
vi.mock("@/lib/supabase/proxy", () => ({ updateSession: vi.fn() }))

/** The PWA files bypass the auth proxy, and /sw.js gets its own headers (Plan P9.1, P9.2). */
describe("auth proxy matcher", () => {
  const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url, nextConfig })

  it.each([
    "/sw.js",
    "/manifest.webmanifest",
    "/offline",
    "/icons/icon-192.png",
    "/apple-icon.png",
  ])("skips %s", (url) => {
    expect(matches(url)).toBe(false)
  })

  it.each(["/offline-x", "/my-work", "/login", "/tasks/abc", "/sw.js.map.html", "/"])(
    "runs on %s",
    (url) => {
      expect(matches(url)).toBe(true)
    },
  )
})

describe("service worker headers", () => {
  const headersFor = async (url: string) =>
    (await unstable_getResponseFromNextConfig({ url, nextConfig })).headers

  it("are never cached and carry a narrow CSP", async () => {
    const h = await headersFor("https://app.example/sw.js")
    expect(h.get("cache-control")).toBe("no-cache, no-store, must-revalidate")
    expect(h.get("content-type")).toBe("application/javascript; charset=utf-8")
    expect(h.get("content-security-policy")).toMatch(/^default-src 'self'; script-src 'self';/)
    // The catch-all's other security headers still apply.
    expect(h.get("x-content-type-options")).toBe("nosniff")
  })

  it("leave other pages on the app CSP", async () => {
    const h = await headersFor("https://app.example/my-work")
    expect(h.get("content-security-policy")).toContain("manifest-src 'self'")
    expect(h.get("cache-control")).toBeNull()
  })
})
