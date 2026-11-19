import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { env } from "@/lib/env"
import type { Database } from "@/types/database.types"

/**
 * Per-request server client for Server Components, Server Actions and Route Handlers.
 * Never share one across requests. Reading cookies makes the caller dynamic, so with
 * Cache Components any Server Component using this must render inside <Suspense>.
 */
export async function createClient() {
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
