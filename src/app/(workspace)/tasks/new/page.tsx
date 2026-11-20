import type { Metadata } from "next"
import { Suspense } from "react"

import { PageContainer, PageHeader } from "@/components/shared/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { createTask } from "@/features/tasks/actions"
import { EMPTY_TASK, TaskForm } from "@/features/tasks/components/task-form"
import {
  listProjectOptions,
  listRepositoryOptions,
  listTaskOptions,
} from "@/features/tasks/queries"

export const metadata: Metadata = { title: "New task" }

/** Full create form (Plan P3.9). ?project= preselects the project and loads its options. */
export default function NewTaskPage({ searchParams }: PageProps<"/tasks/new">) {
  return (
    <PageContainer>
      <PageHeader
        title="New task"
        description="Only the title and project are required. Tasks created here start as Ready."
      />
      <Suspense fallback={<Skeleton className="h-[32rem] w-full max-w-3xl" />}>
        <NewTaskForm searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  )
}

async function NewTaskForm({
  searchParams,
}: {
  searchParams: PageProps<"/tasks/new">["searchParams"]
}) {
  const sp = await searchParams
  const requested = typeof sp.project === "string" ? sp.project : null
  const projects = await listProjectOptions()
  const projectId = projects.some((p) => p.id === requested)
    ? requested
    : projects.length === 1
      ? (projects[0]?.id ?? null)
      : null

  const [repositories, tasks] = projectId
    ? await Promise.all([listRepositoryOptions(projectId), listTaskOptions(projectId)])
    : [[], []]

  return (
    <TaskForm
      action={createTask}
      defaults={EMPTY_TASK}
      projects={projects}
      projectId={projectId}
      repositories={repositories}
      parentOptions={tasks.map((t) => ({ id: t.id, name: t.title }))}
      submitLabel="Create task"
      cancelHref={projectId ? `/projects/${projectId}/tasks` : "/my-work"}
    />
  )
}
