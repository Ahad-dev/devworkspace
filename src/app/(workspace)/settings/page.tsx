import type { Metadata } from "next"
import { Suspense } from "react"

import { EnvironmentBadge, PriorityBadge, TaskStatusBadge } from "@/components/shared/domain-badges"
import { PageContainer, PageHeader } from "@/components/shared/page-header"
import { ThemeSelect } from "@/components/shared/theme-select"
import { Skeleton } from "@/components/ui/skeleton"
import { ProfileForm } from "@/features/profile/components/profile-form"
import { getMyProfile } from "@/features/profile/queries"
import { ENVIRONMENT_TYPES, PRIORITIES, TASK_STATUSES } from "@/lib/constants/domain"

export const metadata: Metadata = { title: "Settings" }

function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section
      aria-labelledby={id}
      className="grid gap-4 border-t pt-6 first-of-type:border-t-0 first-of-type:pt-0 md:grid-cols-[16rem_1fr] md:gap-8"
    >
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="max-w-xl min-w-0">{children}</div>
    </section>
  )
}

export default function Page() {
  return (
    <PageContainer>
      <PageHeader title="Settings" description="Profile, timezone, appearance and your data." />

      <div className="flex flex-col gap-6">
        <SettingsSection
          id="profile-heading"
          title="Profile"
          description="Your name and the timezone used for due dates."
        >
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <ProfileSettings />
          </Suspense>
        </SettingsSection>

        <SettingsSection
          id="appearance-heading"
          title="Appearance"
          description="Light, dark, or follow your system."
        >
          <div className="flex flex-col gap-6">
            <ThemeSelect />
            <dl className="grid gap-3 text-sm sm:grid-cols-[7rem_1fr] sm:items-center">
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
              </dd>
            </dl>
          </div>
        </SettingsSection>

        <SettingsSection
          id="later-heading"
          title="Coming later"
          description="Sections that arrive with the features they control."
        >
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            <li>Default task view: with the task manager (Phase 3)</li>
            <li>Sessions and security, data export, account deletion: Phase 8</li>
          </ul>
        </SettingsSection>
      </div>
    </PageContainer>
  )
}

async function ProfileSettings() {
  const profile = await getMyProfile()
  return (
    <ProfileForm
      mode="settings"
      email={profile.email}
      displayName={profile.displayName}
      timezone={profile.timezone}
    />
  )
}
