import "server-only"

import { connection } from "next/server"

/**
 * The current time for a server render. Server Components render once per request, so reading the
 * clock is safe there; this keeps it out of component bodies (react-hooks/purity) and marks the
 * render as dynamic first, as Cache Components requires before reading the time.
 */
export async function requestTime() {
  await connection()
  return Date.now()
}
