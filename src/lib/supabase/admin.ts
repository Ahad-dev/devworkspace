import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { env } from "@/lib/env"
import type { Database } from "@/types/database.types"

/**
 * Secret-key client: bypasses RLS. Server-only, used for exactly one thing: deleting the signed-in
 * user's own account after they re-enter their password (Plan P8.1). SUPABASE_SECRET_KEY is a
 * server environment variable (never NEXT_PUBLIC_); without it, account deletion is unavailable.
 */
export function createAdminClient(): SupabaseClient<Database> | null {
  const key = process.env.SUPABASE_SECRET_KEY
  if (!key || !key.startsWith("sb_secret_")) return null
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function accountDeletionAvailable() {
  return Boolean(process.env.SUPABASE_SECRET_KEY?.startsWith("sb_secret_"))
}
