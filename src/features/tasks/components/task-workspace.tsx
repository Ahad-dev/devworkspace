import { Suspense } from "react"
import Link from "next/link"
import { CircleCheck, Inbox, ListTodo, SearchX } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { getMyProfile } from "@/features/profile/queries"
import {
  BOARD_LIMIT,
  getTaskViewCounts,
  listLabels,
  listProjectOptions,
  listRepositoryOptions,
  listTasks,
} from "../queries"
import {
  BOARD_DONE_DAYS,
  boardColumns,
  parseTaskFilters,
  type TaskFilters as Filters,
} from "../utils"
import { QuickTaskDialog } from "./quick-task-dialog"
import { TaskBoard } from "./task-board"
import { TaskFilters } from "./task-filters"
import { TaskList, TaskPagination } from "./task-list"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

/**
 * List/board workspace shared by My Work and a project's Tasks tab (Plan P3.7, P3.11).
 * With `project`, results are fixed to that project and the project filter is hidden.
 * `canCreate` is false for archived projects: no quick add or create prompts.
 */
export function TaskWorkspace({
  searchParams,
  basePath,
  project,
  canCreate = true,
}: {
  searchParams: SearchParams
  basePath: string
  project?: { id: string; name: string }
  canCreate?: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      <Suspense fallback={<Skeleton className="h-20 w-full" />}>
        <Toolbar projectId={project?.id} />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-72 w-full" />}>
        <Results
          searchParams={searchParams}
          basePath={basePath}
          project={project}
          canCreate={canCreate}
        />
      </Suspense>
    </div>
  )
}

async function Toolbar({ projectId }: { projectId?: string }) {
  const [counts, labels, projects, repositories, profile] = await Promise.all([
    getTaskViewCounts({ projectId }),
    listLabels(),
    projectId ? undefined : listProjectOptions(),
    projectId ? listRepositoryOptions(projectId) : undefined,
    getMyProfile(),
  ])
  return (
    <TaskFilters
      counts={counts}
      labels={labels}
      projects={projects}
      repositories={repositories}
      defaults={profile.taskView}
    />
  )
}

async function Results({
  searchParams,
  basePath,
  project,
  canCreate,
}: {
  searchParams: SearchParams
  basePath: string
  project?: { id: string; name: string }
  canCreate: boolean
}) {
  const [sp, profile] = await Promise.all([searchParams, getMyProfile()])
  const filters = parseTaskFilters(sp, profile.taskView)
  const { tasks, total, page, pageSize } = await listTasks(filters, { projectId: project?.id })

  if (tasks.length === 0) {
    return <TasksEmpty filters={filters} project={project} canCreate={canCreate} />
  }

  if (filters.layout === "board") {
    const columns = boardColumns(filters)
    const completedHref = `${basePath}?view=completed`
    return (
      <div className="flex flex-col gap-2">
        {total > BOARD_LIMIT ? (
          <p className="text-sm text-muted-foreground">
            Showing {BOARD_LIMIT} of {total} tasks. Narrow the board with filters, or use the list.
          </p>
        ) : null}
        <TaskBoard
          tasks={tasks}
          columns={columns}
          showProject={!project}
          timeZone={profile.timezone}
          // Capture straight into the Inbox column, like Quick add (Plan §9 decision 1).
          quickAdd={
            canCreate && columns.includes("inbox")
              ? project
                ? { fixedProject: project }
                : { projects: listProjectOptions() }
              : undefined
          }
          doneFooter={
            filters.view === "all" && columns.includes("done")
              ? { href: completedHref, days: BOARD_DONE_DAYS }
              : undefined
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <TaskList tasks={tasks} showProject={!project} timeZone={profile.timezone} />
      <TaskPagination
        pathname={basePath}
        searchParams={sp}
        page={page}
        pageSize={pageSize}
        total={total}
      />
    </div>
  )
}

function TasksEmpty({
  filters,
  project,
  canCreate,
}: {
  filters: Filters
  project?: { id: string; name: string }
  canCreate: boolean
}) {
  const filtered = Boolean(
    filters.q ||
    filters.statuses.length ||
    filters.priorities.length ||
    filters.flags.length ||
    filters.labelId ||
    filters.repositoryId ||
    (!project && filters.projectId),
  )
  const copy = filtered
    ? {
        icon: SearchX,
        title: "No tasks match these filters",
        body: "Try a different search or clear the filters.",
      }
    : {
        all: {
          icon: ListTodo,
          title: "No open tasks",
          body: "Capture what needs doing. Quick add puts it in the Inbox to triage later.",
        },
        inbox: {
          icon: Inbox,
          title: "Inbox is clear",
          body: "Everything captured has been triaged.",
        },
        upcoming: {
          icon: ListTodo,
          title: "Nothing due",
          body: "Open tasks with a due date show up here, soonest first.",
        },
        blocked: {
          icon: CircleCheck,
          title: "Nothing is blocked",
          body: "Blocked tasks and what they're waiting on show up here.",
        },
        completed: {
          icon: CircleCheck,
          title: "No completed tasks yet",
          body: "Finished work is kept here, most recent first.",
        },
        archived: {
          icon: ListTodo,
          title: "No archived tasks",
          body: "Archive tasks you no longer need; they're kept here.",
        },
      }[filters.view]
  const Icon = copy.icon
  const showCreate = canCreate && !filtered && filters.view === "all"

  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{copy.title}</EmptyTitle>
        <EmptyDescription>{copy.body}</EmptyDescription>
      </EmptyHeader>
      {showCreate ? (
        <EmptyContent className="flex-row justify-center">
          {project ? <QuickTaskDialog fixedProject={project} /> : null}
          <Link
            href={project ? `/tasks/new?project=${project.id}` : "/tasks/new"}
            className={buttonVariants({ size: "sm" })}
          >
            New task
          </Link>
        </EmptyContent>
      ) : null}
    </Empty>
  )
}
