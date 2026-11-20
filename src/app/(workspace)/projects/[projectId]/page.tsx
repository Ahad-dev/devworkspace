import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { ExternalLink } from "lucide-react"

import { PriorityBadge } from "@/components/shared/domain-badges"
import { Skeleton } from "@/components/ui/skeleton"
import { ActivityList } from "@/features/projects/components/activity-list"
import { TechnologyEditor } from "@/features/projects/components/technology-editor"
import { getMyProfile } from "@/features/profile/queries"
import {
  getProject,
  getProjectCounts,
  listProjectActivity,
  listRepositories,
  listTechnologies,
} from "@/features/projects/queries"
import { REPOSITORY_PURPOSE_LABELS } from "@/lib/constants/domain"
import { formatDate, taskProgress } from "@/lib/format"

export const metadata: Metadata = { title: "Project" }

/** Overview tab (Spec FR-03 / §6.4). */
export default function ProjectOverviewPage({ params }: PageProps<"/projects/[projectId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      {params.then(({ projectId }) => (
        <Overview projectId={projectId} />
      ))}
    </Suspense>
  )
}

function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function ExternalLinkRow({ label, href }: { label: string; href: string | null }) {
  if (!href) return null
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex max-w-full items-center gap-1 text-sm underline-offset-4 hover:underline"
        >
          <span className="truncate">{href.replace(/^https?:\/\//, "")}</span>
          <ExternalLink className="size-3 shrink-0" aria-hidden />
        </a>
      </dd>
    </div>
  )
}

async function Overview({ projectId }: { projectId: string }) {
  const [project, repositories, technologies, activity, profile, counts] = await Promise.all([
    getProject(projectId),
    listRepositories(projectId),
    listTechnologies(projectId),
    listProjectActivity(projectId, 1),
    getMyProfile(),
    getProjectCounts(projectId),
  ])
  const tz = profile.timezone
  const progress = taskProgress(counts.doneTasks, counts.tasks)

  const details = [
    [
      "Tasks",
      <Link
        key="t"
        href={`/projects/${project.id}/tasks`}
        className="underline-offset-4 hover:underline"
      >
        {progress === null
          ? "No tasks"
          : `${counts.openTasks} open · ${counts.doneTasks} of ${counts.tasks} done (${progress}%)`}
      </Link>,
    ],
    ["Priority", project.priority ? <PriorityBadge key="p" priority={project.priority} /> : "-"],
    ["Start date", formatDate(project.start_date, tz) ?? "-"],
    ["Target date", formatDate(project.target_date, tz) ?? "-"],
    ["Last updated", formatDate(project.updated_at, tz)],
  ] as const

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex min-w-0 flex-col gap-8">
        <Section
          title="About"
          action={
            <Link
              href={`/projects/${project.id}/edit`}
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Edit
            </Link>
          }
        >
          {project.description ? (
            // Plain text until the sanitized Markdown renderer lands in Phase 6.
            <p className="text-sm whitespace-pre-wrap">{project.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No description yet. Add the project&apos;s purpose and scope from{" "}
              <Link href={`/projects/${project.id}/edit`} className="underline underline-offset-4">
                Edit
              </Link>
              .
            </p>
          )}
          {project.notes ? (
            <p className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
              {project.notes}
            </p>
          ) : null}
        </Section>

        <Section title="Technology stack">
          <TechnologyEditor
            projectId={project.id}
            technologies={technologies}
            repositories={repositories.map((r) => ({ id: r.id, name: r.name }))}
          />
        </Section>

        <Section
          title="Repositories"
          action={
            <Link
              href={`/projects/${project.id}/repositories`}
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Manage
            </Link>
          }
        >
          {repositories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No repositories yet.{" "}
              <Link
                href={`/projects/${project.id}/repositories`}
                className="underline underline-offset-4"
              >
                Add one
              </Link>
              .
            </p>
          ) : (
            <ul className="flex flex-col divide-y rounded-lg border">
              {repositories.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate font-medium">{r.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {REPOSITORY_PURPOSE_LABELS[r.purpose]}
                    {r.default_branch ? ` · ${r.default_branch}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="Recent activity"
          action={
            activity.total > 5 ? (
              <Link
                href={`/projects/${project.id}/activity`}
                className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                View all
              </Link>
            ) : null
          }
        >
          <ActivityList events={activity.events.slice(0, 5)} timeZone={tz} />
        </Section>
      </div>

      {/* Short details first on small screens; a side column from lg up. */}
      <aside className="order-first flex flex-col gap-6 lg:order-none lg:border-l lg:pl-6">
        <dl className="flex flex-col gap-3">
          {details.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-sm">{value}</dd>
            </div>
          ))}
          <ExternalLinkRow label="Project URL" href={project.project_url} />
          <ExternalLinkRow label="Documentation" href={project.documentation_url} />
        </dl>
      </aside>
    </div>
  )
}
