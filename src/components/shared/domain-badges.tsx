import { cn } from "@/lib/utils"
import {
  ENVIRONMENT_TYPE_META,
  PRIORITY_META,
  TASK_STATUS_META,
  type EnvironmentType,
  type Priority,
  type TaskStatus,
} from "@/lib/constants/domain"

const base =
  "inline-flex h-5 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset"

export function TaskStatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  const meta = TASK_STATUS_META[status]
  const Icon = meta.icon
  return (
    <span className={cn(base, meta.className, className)}>
      <Icon className="size-3" aria-hidden />
      {meta.label}
    </span>
  )
}

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  const meta = PRIORITY_META[priority]
  const Icon = meta.icon
  return (
    <span className={cn(base, meta.className, className)}>
      <Icon className="size-3" aria-hidden />
      {meta.label}
    </span>
  )
}

export function EnvironmentBadge({
  type,
  variant = "label",
  className,
}: {
  type: EnvironmentType
  /** "label" shows the full name, "short" shows e.g. PROD */
  variant?: "label" | "short"
  className?: string
}) {
  const meta = ENVIRONMENT_TYPE_META[type]
  return (
    <span
      className={cn(base, meta.className, variant === "short" && "tracking-wide", className)}
      title={meta.label}
    >
      {variant === "short" ? meta.short : meta.label}
    </span>
  )
}
