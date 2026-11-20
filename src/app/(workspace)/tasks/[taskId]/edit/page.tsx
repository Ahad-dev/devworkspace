import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"

import { PageContainer, PageHeader } from "@/components/shared/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { getMyProfile } from "@/features/profile/queries"
import { updateTask } from "@/features/tasks/actions"
import { TaskForm } from "@/features/tasks/components/task-form"
import { getTask, listRepositoryOptions, listTaskOptions } from "@/features/tasks/queries"
import { toZonedDateInput } from "@/lib/timezones"

export const metadata: Metadata = { title: "Edit task" }

/** Full task edit (Plan P3.9/P3.10). The project is fixed; other fields are editable. */
export default function EditTaskPage({ params }: PageProps<"/tasks/[taskId]/edit">) {
  return (
    <PageContainer>
      <Suspense fallback={<Skeleton className="h-[36rem] w-full max-w-3xl" />}>
        {params.then(({ taskId }) => (
          <EditTask taskId={taskId} />
        ))}
      </Suspense>
    </PageContainer>
  )
}

async function EditTask({ taskId }: { taskId: string }) {
  const task = await getTask(taskId)
  if (task.archived_at) redirect(`/tasks/${task.id}`)
  const [repositories, tasks, profile] = await Promise.all([
    listRepositoryOptions(task.project_id),
    listTaskOptions(task.project_id, task.id),
    getMyProfile(),
  ])

  return (
    <>
      <Link
        href={`/tasks/${task.id}`}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Back to task
      </Link>
      <PageHeader title="Edit task" description={`In ${task.project.name}`} />
      <TaskForm
        action={updateTask.bind(null, task.id)}
        defaults={{
          title: task.title,
          status: task.status,
          priority: task.priority,
          description: task.description ?? "",
          next_action: task.next_action ?? "",
          blocker_details: task.blocker_details ?? "",
          due_date: toZonedDateInput(task.due_at, profile.timezone),
          repository_id: task.repository_id,
          parent_task_id: task.parent_task_id,
          external_reference_url: task.external_reference_url ?? "",
        }}
        projectId={task.project_id}
        repositories={repositories}
        parentOptions={tasks.map((t) => ({ id: t.id, name: t.title }))}
        submitLabel="Save task"
        cancelHref={`/tasks/${task.id}`}
      />
    </>
  )
}
