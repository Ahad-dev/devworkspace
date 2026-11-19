import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { connection } from "next/server"

import { env } from "@/lib/env"
import type { Database } from "@/types/database.types"

/**
 * Per-request server client for Server Components, Server Actions and Route Handlers.
 * Never share one across requests. Callers are dynamic, so with Cache Components any
 * Server Component using this must render inside <Suspense>.
 */
export async function createClient() {
  // Supabase checks token expiry with Date.now(). Cookies are available during the runtime
  // prefetch render, but Date.now() isn't, so wait for the real request first. Without this,
  // Next 16 errors with "encountered the unstable value Date.now() while prerendering".
  await connection()
  const cookieStore = await cookies()

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Called from a Server Component, which can't set cookies.
            // Safe to ignore: src/proxy.ts refreshes the session on every request.
          }
        },
      },
    },
  )
}
