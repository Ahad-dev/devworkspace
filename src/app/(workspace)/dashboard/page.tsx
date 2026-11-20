import type { Metadata } from "next"
import { Suspense } from "react"

import { PageContainer } from "@/components/shared/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AttentionTiles,
  DashboardSection,
  FirstRun,
  FocusCard,
  ProjectProgressList,
  SectionLink,
  TaskRows,
} from "@/features/dashboard/components/dashboard-sections"
import { QuickActions } from "@/features/dashboard/components/quick-actions"
import {
  getCurrentFocus,
  getDashboardSummary,
  listProjectOverview,
  listRecentActivity,
  listUpcoming,
  listWorkQueue,
} from "@/features/dashboard/queries"
import { greeting } from "@/features/dashboard/utils"
import { getMyProfile } from "@/features/profile/queries"
import { ActivityList } from "@/features/projects/components/activity-list"
import { requestTime } from "@/lib/request-time"

export const metadata: Metadata = { title: "Overview" }

/** Global dashboard (Spec FR-02, §6.2; Plan P7.2): what needs attention across projects. */
export default function DashboardPage() {
  return (
    <PageContainer>
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
    </PageContainer>
  )
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-12 w-full max-w-md" />
      <Skeleton className="h-9 w-full max-w-2xl" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  )
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

async function Dashboard() {
  const [profile, now] = await Promise.all([getMyProfile(), requestTime()])
  const tz = profile.timezone
  const [summary, focus, queue, upcoming, projects, activity] = await Promise.all([
    getDashboardSummary(),
    getCurrentFocus(),
    listWorkQueue(8),
    listUpcoming(tz, now, 8),
    listProjectOverview(8),
    listRecentActivity(10),
  ])
  const name = profile.displayName?.trim().split(/\s+/)[0]
  const headline = [
    plural(summary.in_progress, "task") + " in progress",
    `${summary.ready} ready`,
    summary.overdue ? `${summary.overdue} overdue` : null,
    summary.blocked ? `${summary.blocked} blocked` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">
          {greeting(now, tz)}
          {name ? `, ${name}` : ""}. {projects.total ? headline : "Nothing here yet."}
        </p>
      </header>

      <QuickActions />

      {projects.total === 0 && queue.total === 0 ? (
        <FirstRun />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-8">
            <DashboardSection title="Current focus" id="focus-heading">
              <FocusCard session={focus} renderedAt={now} />
            </DashboardSection>

            <DashboardSection
              title="Work queue"
              id="queue-heading"
              action={
                queue.total > queue.tasks.length ? (
                  <SectionLink href="/my-work?status=in_progress,ready">
                    All {queue.total}
                  </SectionLink>
                ) : (
                  <SectionLink href="/my-work">My work</SectionLink>
                )
              }
            >
              <TaskRows
                tasks={queue.tasks}
                timeZone={tz}
                now={now}
                empty="No Ready or In Progress tasks. Triage your inbox or plan the next task."
              />
            </DashboardSection>

            <DashboardSection
              title="Upcoming deadlines"
              id="upcoming-heading"
              action={<SectionLink href="/my-work?view=upcoming">All upcoming</SectionLink>}
            >
              <TaskRows
                tasks={upcoming}
                timeZone={tz}
                now={now}
                empty="Nothing due in the next 7 days."
              />
            </DashboardSection>
          </div>

          <div className="flex min-w-0 flex-col gap-8">
            <DashboardSection title="Attention required" id="attention-heading">
              <AttentionTiles summary={summary} />
            </DashboardSection>

            <DashboardSection
              title="Projects"
              id="projects-heading"
              action={
                <SectionLink href="/projects">
                  {projects.total > projects.projects.length ? `All ${projects.total}` : "All"}
                </SectionLink>
              }
            >
              {projects.projects.length ? (
                <ProjectProgressList projects={projects.projects} now={now} />
              ) : (
                <p className="text-sm text-muted-foreground">No active projects.</p>
              )}
            </DashboardSection>

            <DashboardSection
              title="Recent activity"
              id="activity-heading"
              action={<SectionLink href="/activity">All activity</SectionLink>}
            >
              <ActivityList events={activity} timeZone={tz} showContext now={now} />
            </DashboardSection>
          </div>
        </div>
      )}
    </div>
  )
}
