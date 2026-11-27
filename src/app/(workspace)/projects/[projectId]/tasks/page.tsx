import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { Plus } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getProject } from "@/features/projects/queries"
import { QuickTaskDialog } from "@/features/tasks/components/quick-task-dialog"
import { TaskWorkspace } from "@/features/tasks/components/task-workspace"

export const metadata: Metadata = { title: "Tasks" }

/** Project Tasks tab (Plan P3.11): the shared list/board with the project fixed. */
export default function ProjectTasksPage({
  params,
  searchParams,
}: PageProps<"/projects/[projectId]/tasks">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      {params.then(({ projectId }) => (
        <ProjectTasks projectId={projectId} searchParams={searchParams} />
      ))}
    </Suspense>
  )
}

async function ProjectTasks({
  projectId,
  searchParams,
}: {
  projectId: string
  searchParams: PageProps<"/projects/[projectId]/tasks">["searchParams"]
}) {
  const project = await getProject(projectId)
  const fixed = { id: project.id, name: project.name }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Tasks</h2>
        {project.status !== "archived" ? (
          <div className="flex items-center gap-2">
            <QuickTaskDialog fixedProject={fixed} />
            <Link
              href={`/tasks/new?project=${project.id}`}
              className={buttonVariants({ size: "sm" })}
            >
              <Plus />
              New task
            </Link>
          </div>
        ) : null}
      </div>
      <TaskWorkspace
        searchParams={searchParams}
        basePath={`/projects/${project.id}/tasks`}
        project={fixed}
        canCreate={project.status !== "archived"}
      />
    </div>
  )
}
