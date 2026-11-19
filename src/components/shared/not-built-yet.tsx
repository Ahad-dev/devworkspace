import type { LucideIcon } from "lucide-react"

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

/**
 * Temporary empty state for areas whose feature hasn't been built yet.
 * Each page replaces this with its real content and real empty state in its phase.
 */
export function NotBuiltYet({
  icon: Icon,
  title,
  description,
  phase,
}: {
  icon: LucideIcon
  title: string
  description: string
  phase: string
}) {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
        <p className="text-xs text-muted-foreground">Planned for {phase}</p>
      </EmptyHeader>
    </Empty>
  )
}
