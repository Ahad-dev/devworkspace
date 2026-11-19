import "server-only"

import { cache } from "react"
import { redirect } from "next/navigation"

import { LOGIN_PATH } from "@/lib/auth/routes"
import { createClient } from "@/lib/supabase/server"

export type CurrentUser = {
  id: string
  email: string | null
}

/**
 * Data Access Layer entry point: the verified current user, or null.
 * getClaims() validates the JWT, unlike getSession(), which trusts the cookie as-is.
 * Reads cookies, so callers render inside <Suspense> (Cache Components).
 * Deduplicated per request with React cache().
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (error || !claims?.sub) return null
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null }
})

/** Use in server code that must not run for anonymous users. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) redirect(LOGIN_PATH)
  return user
}
