"use client"

import { cn } from "@/lib/utils"

/**
 * A row of mutually exclusive options that switches a view or filter in place. Looks like the
 * tabs, but it's a labelled group of toggle buttons (aria-pressed): tabs need tab panels, and
 * these controls drive a URL or a mode instead.
 */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
}: {
  value: T
  onValueChange: (value: T) => void
  options: readonly { value: T; label: React.ReactNode; className?: string }[]
  /** Names the group for assistive tech, e.g. "Show". */
  label: string
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex h-8 w-fit items-center rounded-lg bg-muted p-[3px] text-muted-foreground",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onValueChange(o.value)}
            className={cn(
              "inline-flex h-full items-center justify-center rounded-md border border-transparent px-2.5 text-sm font-medium whitespace-nowrap transition-all outline-none hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
              active
                ? "bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30"
                : "text-foreground/60 dark:text-muted-foreground",
              o.className,
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
