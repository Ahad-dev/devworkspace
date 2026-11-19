import { cn } from "@/lib/utils"
import {
  PROJECT_STATUS_META,
  PROJECT_TYPE_LABELS,
  type ProjectStatus,
  type ProjectType,
} from "@/lib/constants/domain"

const base =
  "inline-flex h-5 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset"

export function ProjectStatusBadge({
  status,
  className,
}: {
  status: ProjectStatus
  className?: string
}) {
  const meta = PROJECT_STATUS_META[status]
  const Icon = meta.icon
  return (
    <span className={cn(base, meta.className, className)}>
      <Icon className="size-3" aria-hidden />
      {meta.label}
    </span>
  )
}

export function projectTypeLabel(type: ProjectType) {
  return PROJECT_TYPE_LABELS[type]
}
