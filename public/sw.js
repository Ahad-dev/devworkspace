/**
 * DevWorkspace service worker (Spec §2.2 "PWA/offline"; Plan P9.2).
 *
 * What it keeps: the static offline page (/offline, which holds no user data), the hashed
 * /_next/static assets and the app icons. Nothing else. Workspace pages, their RSC payloads,
 * server actions and Supabase requests always go to the network and are never stored here: the
 * only user data on the device is the offline copy of tasks in IndexedDB, which the app manages.
 *
 * Page loads go to the network; when that fails, the offline page is served in place of the page,
 * and it shows the saved copy for the address in the bar.
 *
 * Caches are named after the build (`?v=` on this script's URL), so each deploy installs a fresh
 * offline page with matching assets and drops the previous caches.
 */

const VERSION = new URL(self.location.href).searchParams.get("v") || "dev"
const SHELL_CACHE = `dw-shell-${VERSION}`
const STATIC_CACHE = `dw-static-${VERSION}`
const OFFLINE_URL = "/offline"
const ICONS = ["/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png"]
// Asset paths anywhere in the page, including inside Next's inline data and font preloads.
const ASSET_IN_HTML = /\/_next\/static\/[^"'\\\s<>)]+/g
const URL_IN_CSS = /url\(\s*["']?([^"')]+)["']?\s*\)/g

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      // Never keep a redirect (e.g. to the sign-in page): a redirected response can't stand in
      // for a page load.
      const res = await fetch(OFFLINE_URL, { cache: "reload", redirect: "error" })
      if (!res.ok || res.redirected) throw new Error("The offline page is unavailable")
      const html = await res.clone().text()
      await (await caches.open(SHELL_CACHE)).put(OFFLINE_URL, res)

      const assets = [...new Set(html.match(ASSET_IN_HTML) || [])]
      const fonts = await Promise.all(assets.map(precache))
      await Promise.allSettled([...new Set(fonts.flat())].map(precache))
      await Promise.allSettled(ICONS.map(precache))
      await self.skipWaiting()
    })(),
  )
})

/** Caches one same-origin static file; for a stylesheet, returns the static files it uses. */
async function precache(path) {
  try {
    const url = new URL(path, self.location.origin)
    const res = await fetch(url, { cache: "reload" })
    if (!res.ok || res.redirected) return []
    const used = url.pathname.endsWith(".css") ? cssUrls(await res.clone().text(), url) : []
    await (await caches.open(STATIC_CACHE)).put(url, res)
    return used
  } catch {
    return []
  }
}

function cssUrls(css, base) {
  const found = []
  for (const match of css.matchAll(URL_IN_CSS)) {
    try {
      const url = new URL(match[1], base)
      if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
        found.push(url.pathname)
      }
    } catch {
      // Not a URL (e.g. a data: value with odd quoting): skip it.
    }
  }
  return found
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const current = new Set([SHELL_CACHE, STATIC_CACHE])
      for (const key of await caches.keys()) {
        if (key.startsWith("dw-") && !current.has(key)) await caches.delete(key)
      }
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable()
      await self.clients.claim()
    })(),
  )
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === "navigate") {
    event.respondWith(pageLoad(event))
  } else if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request))
  }
  // Everything else (RSC payloads, prefetches, API and auth calls) is left to the browser.
})

async function pageLoad(event) {
  try {
    const preloaded = await event.preloadResponse
    if (preloaded) return preloaded
    return await fetch(event.request)
  } catch {
    const shell = await caches.match(OFFLINE_URL, { cacheName: SHELL_CACHE })
    return shell || Response.error()
  }
}

/** Hashed build files never change: serve a stored copy, or fetch and store one. */
async function cacheFirst(request) {
  // ignoreSearch: deployment skew protection may add a query string to asset URLs.
  const cached = await caches.match(request, { ignoreSearch: true })
  if (cached) return cached
  const res = await fetch(request)
  if (res.ok && res.type === "basic") {
    const copy = res.clone()
    ignoreFailure(caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy)))
  }
  return res
}

/** Storing a fetched asset must not delay or fail the response. */
function ignoreFailure(promise) {
  promise.catch(() => {})
}
