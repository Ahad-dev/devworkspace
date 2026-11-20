import "server-only"

import { requireUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { toResults, type SearchResult } from "./utils"

/**
 * Owner-scoped search (Spec FR-12; Plan P7.4) through global_search(), which runs as the signed-in
 * user under RLS. Up to `limitPerKind` results for each kind.
 */
export async function searchWorkspace(q: string, limitPerKind = 5): Promise<SearchResult[]> {
  const query = q.trim().slice(0, 100)
  if (query.length < 2) return []
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("global_search", {
    p_query: query,
    p_limit: limitPerKind,
  })
  if (error) throw new Error("Search failed")
  return toResults(data ?? [])
}
