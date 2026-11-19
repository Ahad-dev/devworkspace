import { createBrowserClient } from "@supabase/ssr"

import { env } from "@/lib/env"
import type { Database } from "@/types/database.types"

/** Browser client for Client Components. Uses the publishable key; RLS does the authorization. */
export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  )
}
