import { TriangleAlert } from "lucide-react"

import {
  COMMAND_OS_LABELS,
  COMMAND_SHELL_LABELS,
  DOC_CATEGORY_LABELS,
  type CommandOs,
  type CommandShell,
  type DocCategory,
} from "@/lib/constants/domain"
import { cn } from "@/lib/utils"

const base =
  "inline-flex h-5 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset"

export function DocCategoryBadge({
  category,
  className,
}: {
  category: DocCategory
  className?: string
}) {
  return (
    <span className={cn(base, "bg-muted/60 text-muted-foreground ring-border", className)}>
      {DOC_CATEGORY_LABELS[category]}
    </span>
  )
}

/** The shell and OS a command expects (Spec FR-11 "clearly show the expected shell"). */
export function ShellBadge({ shell, os }: { shell: CommandShell; os: CommandOs }) {
  return (
    <span className={cn(base, "bg-muted/60 font-mono text-foreground ring-border")}>
      {COMMAND_SHELL_LABELS[shell]}
      <span className="text-muted-foreground">· {COMMAND_OS_LABELS[os]}</span>
    </span>
  )
}

export function DestructiveBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        base,
        "bg-status-blocked/10 text-status-blocked ring-status-blocked/30",
        className,
      )}
    >
      <TriangleAlert className="size-3" aria-hidden />
      Destructive
    </span>
  )
}
