import type { NextConfig } from "next"

const isDev = process.env.NODE_ENV === "development"

/**
 * Security headers (Spec §9.5; Plan P8.3).
 *
 * The CSP is static: Cache Components prerender a shell, which rules out per-request nonces, so
 * scripts keep 'unsafe-inline' for Next's own inline bootstrap. That is backed by never rendering
 * raw HTML (sanitized Markdown, React escaping). Everything else is narrowed: the app talks only to
 * itself and to its Supabase project, can't be framed, and can't submit forms elsewhere.
 */
function supabaseOrigins() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return []
  const { host } = new URL(url)
  return [`https://${host}`, `wss://${host}`]
}

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self' ${supabaseOrigins().join(" ")}${isDev ? " ws://localhost:* ws://127.0.0.1:*" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ")

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
]

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

export default nextConfig
