import type { Metadata } from "next"
import { Suspense } from "react"

import { EnvironmentBadge, PriorityBadge, TaskStatusBadge } from "@/components/shared/domain-badges"
import { PageContainer, PageHeader } from "@/components/shared/page-header"
import { ThemeSelect } from "@/components/shared/theme-select"
import { Skeleton } from "@/components/ui/skeleton"
import { ProfileForm } from "@/features/profile/components/profile-form"
import { getMyProfile } from "@/features/profile/queries"
import { DeleteAccountDialog } from "@/features/settings/components/delete-account-dialog"
import { DevicePanel } from "@/features/settings/components/device-panel"
import { ExportPanel } from "@/features/settings/components/export-panel"
import { SecurityPanel } from "@/features/settings/components/security-panel"
import { TaskViewForm } from "@/features/settings/components/task-view-form"
import { accountDeletionAvailable } from "@/lib/supabase/admin"
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
      <PageHeader
        title="Settings"
        description="Profile, task view, appearance, security, this device and your data."
      />

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
          id="task-view-heading"
          title="Default task view"
          description="How My Work and project task tabs open."
        >
          <Suspense fallback={<Skeleton className="h-28 w-full" />}>
            <TaskViewSettings />
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
          id="security-heading"
          title="Security"
          description="Your password and where you're signed in."
        >
          <Suspense fallback={<Skeleton className="h-24 w-full" />}>
            <SecuritySettings />
          </Suspense>
        </SettingsSection>

        <SettingsSection
          id="device-heading"
          title="This device"
          description="Install the app, and the copy of your tasks this browser keeps for offline reading."
        >
          <DevicePanel />
        </SettingsSection>

        <SettingsSection
          id="export-heading"
          title="Your data"
          description="Download everything you've stored, any time."
        >
          <ExportPanel />
        </SettingsSection>

        <SettingsSection
          id="delete-heading"
          title="Delete account"
          description="Permanently remove your account and all of its data."
        >
          <Suspense fallback={<Skeleton className="h-24 w-full" />}>
            <DeleteSettings />
          </Suspense>
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

async function TaskViewSettings() {
  const profile = await getMyProfile()
  return <TaskViewForm defaults={profile.taskView} />
}

async function SecuritySettings() {
  const profile = await getMyProfile()
  return <SecurityPanel email={profile.email} />
}

async function DeleteSettings() {
  // After the session read, so the key check runs per request and never in the static shell.
  await getMyProfile()
  return <DeleteAccountDialog available={accountDeletionAvailable()} />
}
