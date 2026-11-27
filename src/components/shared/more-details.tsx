"use client"

import * as React from "react"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * "More details" for long forms (Plan P10.4): the essential fields stay visible, the rest fold away.
 * A native <details> keeps the folded inputs mounted, so they are still submitted and an edit never
 * wipes a saved value. `open` forces it open, e.g. when a folded field holds a value or an error.
 */
export function MoreDetails({
  open: forced = false,
  label = "More details",
  hint,
  children,
  className,
}: {
  open?: boolean
  label?: string
  /** What's inside, shown next to the label while folded, e.g. "branch, path, notes". */
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  const [userOpen, setUserOpen] = React.useState(false)
  const open = forced || userOpen
  return (
    <details
      open={open}
      onToggle={(e) => setUserOpen(e.currentTarget.open)}
      className={cn("group rounded-lg border", className)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium outline-none select-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="size-4 text-muted-foreground transition-transform group-open:rotate-90"
          aria-hidden
        />
        {label}
        {hint && !open ? (
          <span className="truncate font-normal text-muted-foreground">({hint})</span>
        ) : null}
      </summary>
      <div className="flex flex-col gap-5 px-3 pt-2 pb-3">{children}</div>
    </details>
  )
}
