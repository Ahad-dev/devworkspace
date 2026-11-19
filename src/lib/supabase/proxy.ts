import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { DEFAULT_AFTER_LOGIN, LOGIN_PATH, isGuestOnlyPath, isPublicPath } from "@/lib/auth/routes"
import { env } from "@/lib/env"

/**
 * Refreshes the Supabase session on every request and does the optimistic route check.
 * This is not the authorization boundary: RLS is. It only keeps logged-out visitors out of
 * app pages and keeps auth cookies fresh for Server Components.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
          // no-store headers: a response carrying auth cookies must never be cached by a CDN.
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value))
        },
      },
    },
  )

  // Don't run code between createServerClient and getClaims(): it refreshes the session.
  const { data } = await supabase.auth.getClaims()
  const signedIn = Boolean(data?.claims?.sub)
  const { pathname, search } = request.nextUrl

  if (!signedIn && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = LOGIN_PATH
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`
    return redirectKeepingCookies(url, response)
  }

  if (signedIn && isGuestOnlyPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = DEFAULT_AFTER_LOGIN
    url.search = ""
    return redirectKeepingCookies(url, response)
  }

  return response
}

/** A redirect must carry any refreshed auth cookies and no-store headers, or the session desyncs. */
function redirectKeepingCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url)
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
  from.headers.forEach((value, key) => {
    const k = key.toLowerCase()
    if (k === "cache-control" || k === "expires" || k === "pragma") redirect.headers.set(key, value)
  })
  return redirect
}
