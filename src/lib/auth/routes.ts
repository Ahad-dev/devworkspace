/** Auth routing rules shared by the proxy, auth actions and the confirm route. */

export const LOGIN_PATH = "/login"
export const DEFAULT_AFTER_LOGIN = "/dashboard"
export const ONBOARDING_PATH = "/onboarding"

/** Pages reachable without a session. Everything else requires sign-in. */
const PUBLIC_PREFIXES = ["/login", "/reset-password", "/auth/"]

/** Signed-in users visiting these are sent to the app instead. */
const GUEST_ONLY = ["/login", "/reset-password"]

export function isPublicPath(pathname: string) {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : `${p}/`),
  )
}

export function isGuestOnlyPath(pathname: string) {
  return GUEST_ONLY.includes(pathname)
}

/**
 * Only allow same-origin relative redirects ("/projects?x=1"), never "//evil.com",
 * "/\evil.com" or absolute URLs. Prevents open redirects through ?next=.
 */
export function safeNextPath(next: string | null | undefined, fallback = DEFAULT_AFTER_LOGIN) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback
  }
  return next
}
