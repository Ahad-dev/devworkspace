"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Monitor, Moon, Sun } from "lucide-react"

import { cn } from "@/lib/utils"

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const

const noopSubscribe = () => () => {}

/** Segmented theme control for Settings → Appearance. */
export function ThemeSelect() {
  const { theme, setTheme } = useTheme()
  // The stored theme is only known in the browser; render no selection on the server.
  const mounted = React.useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
  const current = mounted ? (theme ?? "system") : null

  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-lg border p-0.5">
      {OPTIONS.map((o) => {
        const selected = current === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(o.value)}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              selected
                ? "bg-secondary font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <o.icon className="size-3.5" aria-hidden />
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
