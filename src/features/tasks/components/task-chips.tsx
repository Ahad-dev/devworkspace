import { AlertTriangle, CalendarClock, CornerDownRight } from "lucide-react"

import { LABEL_COLOR_META, type LabelColor } from "@/lib/constants/domain"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Small, server-safe presentational pieces shared by the list, board and detail page. */

const chip =
  "inline-flex h-5 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset"

export function LabelChip({ name, color }: { name: string; color: LabelColor }) {
  return <span className={cn(chip, LABEL_COLOR_META[color].chip)}>{name}</span>
}

export function LabelChips({
  labels,
  max = 3,
}: {
  labels: { id: string; name: string; color: LabelColor }[]
  max?: number
}) {
  if (labels.length === 0) return null
  const shown = labels.slice(0, max)
  const rest = labels.length - shown.length
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {shown.map((l) => (
        <LabelChip key={l.id} name={l.name} color={l.color} />
      ))}
      {rest > 0 ? <span className="text-xs text-muted-foreground">+{rest}</span> : null}
    </span>
  )
}

/** Due date; overdue is red with an icon and a text label, so colour isn't the only signal. */
export function DueDate({
  dueAt,
  overdue,
  timeZone,
  className,
}: {
  dueAt: string | null
  overdue: boolean
  timeZone: string
  className?: string
}) {
  if (!dueAt) return <span className={cn("text-muted-foreground", className)}>-</span>
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap",
        overdue ? "font-medium text-destructive" : "text-muted-foreground",
        className,
      )}
    >
      {overdue ? (
        <AlertTriangle className="size-3.5" aria-hidden />
      ) : (
        <CalendarClock className="size-3.5" aria-hidden />
      )}
      {formatDate(dueAt, timeZone)}
      {overdue ? <span className="sr-only">(overdue)</span> : null}
    </span>
  )
}

/** "Next action" indicator for list rows (Spec §6.5). */
export function NextActionIndicator({
  nextAction,
  missing,
}: {
  nextAction: string | null
  missing: boolean
}) {
  if (missing) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap text-status-in-progress">
        <AlertTriangle className="size-3.5" aria-hidden />
        Missing
      </span>
    )
  }
  if (!nextAction) return <span className="text-muted-foreground">-</span>
  return (
    <span
      className="inline-flex max-w-56 items-center gap-1 text-xs text-muted-foreground"
      title={nextAction}
    >
      <CornerDownRight className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{nextAction}</span>
    </span>
  )
}
