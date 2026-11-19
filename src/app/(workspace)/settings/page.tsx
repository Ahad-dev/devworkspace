import type { Metadata } from "next"
import { UserCog } from "lucide-react"

import { EnvironmentBadge, PriorityBadge, TaskStatusBadge } from "@/components/shared/domain-badges"
import { NotBuiltYet } from "@/components/shared/not-built-yet"
import { PageContainer, PageHeader } from "@/components/shared/page-header"
import { ENVIRONMENT_TYPES, PRIORITIES, TASK_STATUSES } from "@/lib/constants/domain"

export const metadata: Metadata = { title: "Settings" }

export default function Page() {
  return (
    <PageContainer>
      <PageHeader title="Settings" description="Profile, timezone, appearance and your data." />

      <NotBuiltYet
        icon={UserCog}
        title="Profile and preferences"
        description="Display name, timezone and default task view need a signed-in account."
        phase="Phase 1 (P1.9), export and account deletion in Phase 8"
      />

      <section className="flex flex-col gap-4" aria-labelledby="labels-heading">
        <div className="flex flex-col gap-1">
          <h2 id="labels-heading" className="text-base font-semibold">
            Labels and colours
          </h2>
          <p className="text-sm text-muted-foreground">
            How statuses, priorities and environments look across the app. Switch the theme to check
            both modes.
          </p>
        </div>
        <dl className="grid gap-4 text-sm sm:grid-cols-[8rem_1fr] sm:items-center">
          <dt className="text-muted-foreground">Task status</dt>
          <dd className="flex flex-wrap gap-2">
            {TASK_STATUSES.map((s) => (
              <TaskStatusBadge key={s} status={s} />
            ))}
          </dd>
          <dt className="text-muted-foreground">Priority</dt>
          <dd className="flex flex-wrap gap-2">
            {PRIORITIES.map((p) => (
              <PriorityBadge key={p} priority={p} />
            ))}
          </dd>
          <dt className="text-muted-foreground">Environment</dt>
          <dd className="flex flex-wrap gap-2">
            {ENVIRONMENT_TYPES.map((t) => (
              <EnvironmentBadge key={t} type={t} />
            ))}
            {ENVIRONMENT_TYPES.map((t) => (
              <EnvironmentBadge key={`${t}-short`} type={t} variant="short" />
            ))}
          </dd>
        </dl>
      </section>
    </PageContainer>
  )
}
