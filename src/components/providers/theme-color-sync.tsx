"use client"

import * as React from "react"
import { useTheme } from "next-themes"

const COLORS = { light: "#ffffff", dark: "#0a0a0a" } as const

/**
 * Keeps the browser and installed-app title bar in the app's theme (Plan P9.1). The static
 * `viewport.themeColor` follows the system setting; this follows an explicit Light or Dark choice.
 */
export function ThemeColorSync() {
  const { resolvedTheme } = useTheme()
  React.useEffect(() => {
    if (resolvedTheme !== "light" && resolvedTheme !== "dark") return
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
      meta.content = COLORS[resolvedTheme]
    }
  }, [resolvedTheme])
  return null
}
