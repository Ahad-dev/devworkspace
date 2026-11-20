"use server"

import { searchWorkspace } from "./queries"
import type { SearchResult } from "./utils"

/** The command palette's search (Plan P7.5): a few results per kind. */
export async function quickSearch(
  q: string,
): Promise<{ ok: true; results: SearchResult[] } | { ok: false; error: string }> {
  if (typeof q !== "string") return { ok: false, error: "Type something to search." }
  try {
    return { ok: true, results: await searchWorkspace(q, 4) }
  } catch {
    return { ok: false, error: "Search failed. Try again." }
  }
}
