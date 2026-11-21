"use client"

import * as React from "react"
import Link from "next/link"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core"
import { CircleSlash, GripVertical } from "lucide-react"
import { toast } from "sonner"

import { PriorityBadge, TaskStatusBadge } from "@/components/shared/domain-badges"
import { TASK_STATUS_META, type TaskStatus } from "@/lib/constants/domain"
import { cn } from "@/lib/utils"
import { changeTaskStatus } from "../actions"
import type { TaskListRow } from "../queries"
import { BOARD_COLUMNS, compareTasks } from "../utils"
import { BlockerDialog } from "./blocker-dialog"
import { DueDate, LabelChips } from "./task-chips"
import { TaskStatusMenu } from "./task-status-menu"
import { offlineResult, whenOnline } from "@/lib/offline/guard"

type Move = { id: string; status: TaskStatus; blockerDetails?: string }

/**
 * Kanban board (Spec §6.6; Plan P3.8). Drag a card by its handle to change status. The move shows
 * at once and rolls back with a toast if the server rejects it (useOptimistic resets to the
 * server's data when the transition ends). Keyboard: the handle supports space + arrow keys, and
 * every card has a status menu. Dropping into Blocked asks for blocker details first.
 */
export function TaskBoard({
  tasks,
  showProject,
  timeZone,
}: {
  tasks: TaskListRow[]
  showProject: boolean
  timeZone: string
}) {
  const [optimistic, applyMove] = React.useOptimistic(tasks, (state: TaskListRow[], m: Move) =>
    state.map((t) =>
      t.id === m.id
        ? {
            ...t,
            status: m.status,
            blocker_details: m.status === "blocked" ? (m.blockerDetails ?? null) : null,
            overdue: m.status === "done" ? false : t.overdue,
            missingNextAction: m.status === "in_progress" && !t.next_action,
          }
        : t,
    ),
  )
  const [moving, startTransition] = React.useTransition()
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [blockTarget, setBlockTarget] = React.useState<{ id: string; title: string } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnKeyboardCoordinates }),
  )

  const byId = React.useMemo(() => new Map(optimistic.map((t) => [t.id, t])), [optimistic])
  const columns = React.useMemo(
    () =>
      BOARD_COLUMNS.map((status) => ({
        status,
        tasks: optimistic.filter((t) => t.status === status).sort(compareTasks),
      })),
    [optimistic],
  )

  function move(m: Move) {
    startTransition(async () => {
      applyMove(m)
      const result = await whenOnline(
        () =>
          changeTaskStatus({
            taskId: m.id,
            status: m.status,
            blockerDetails: m.blockerDetails,
          }),
        offlineResult,
      )
      if (!result.ok) toast.error(result.error, { description: "The task was moved back." })
    })
  }

  function requestMove(id: string, status: TaskStatus, blockerDetails?: string) {
    const task = byId.get(id)
    if (!task || task.status === status) return
    if (status === "blocked" && !blockerDetails) setBlockTarget({ id, title: task.title })
    else move({ id, status, blockerDetails })
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null)
    if (e.over) requestMove(String(e.active.id), e.over.id as TaskStatus)
  }

  const title = (id: string | number) => byId.get(String(id))?.title ?? "Task"
  const columnLabel = (id: string | number) => TASK_STATUS_META[id as TaskStatus]?.label ?? id
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${title(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${title(active.id)} is over ${columnLabel(over.id)}.`
        : `${title(active.id)} is not over a column.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${title(active.id)} was dropped into ${columnLabel(over.id)}.`
        : `${title(active.id)} was dropped.`,
    onDragCancel: ({ active }) => `Moving ${title(active.id)} was cancelled.`,
  }

  const activeTask = activeId ? byId.get(activeId) : undefined

  return (
    <>
      <DndContext
        id="task-board"
        sensors={sensors}
        onDragStart={(e) => setActiveId(String(e.active.id))}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={onDragEnd}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              "To move a task, press space or enter on its handle, use the left and right arrow keys to choose a column, then press space or enter to drop it, or escape to cancel. Each card also has a status menu.",
          },
        }}
      >
        <div
          data-slot="task-board"
          aria-busy={moving}
          className="-mx-4 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6"
        >
          <div className="grid w-max grid-flow-col gap-3" style={{ gridAutoColumns: "17rem" }}>
            {columns.map((col) => (
              <BoardColumn key={col.status} status={col.status} count={col.tasks.length}>
                {col.tasks.map((t) => (
                  <DraggableCard
                    key={t.id}
                    task={t}
                    showProject={showProject}
                    timeZone={timeZone}
                    onStatusChange={(status, details) => requestMove(t.id, status, details)}
                  />
                ))}
              </BoardColumn>
            ))}
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <CardBody
              task={activeTask}
              showProject={showProject}
              timeZone={timeZone}
              className="rotate-1 shadow-lg"
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <BlockerDialog
        open={blockTarget !== null}
        taskTitle={blockTarget?.title}
        onCancel={() => setBlockTarget(null)}
        onConfirm={(details) => {
          if (blockTarget) move({ id: blockTarget.id, status: "blocked", blockerDetails: details })
          setBlockTarget(null)
        }}
      />
    </>
  )
}

function BoardColumn({
  status,
  count,
  children,
}: {
  status: TaskStatus
  count: number
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <section
      aria-label={`${TASK_STATUS_META[status].label} column, ${count} ${count === 1 ? "task" : "tasks"}`}
      className="flex flex-col gap-2"
    >
      <header className="flex items-center justify-between px-1">
        <TaskStatusBadge status={status} />
        <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
      </header>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-48 flex-1 flex-col gap-2 rounded-lg border border-dashed bg-muted/30 p-2 transition-colors",
          isOver && "border-primary/50 bg-primary/5",
        )}
      >
        {count === 0 ? (
          <p className="px-1 py-4 text-center text-xs text-muted-foreground">No tasks</p>
        ) : (
          children
        )}
      </div>
    </section>
  )
}

function DraggableCard({
  task,
  showProject,
  timeZone,
  onStatusChange,
}: {
  task: TaskListRow
  showProject: boolean
  timeZone: string
  onStatusChange: (status: TaskStatus, blockerDetails?: string) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })
  return (
    <div ref={setNodeRef} className={cn(isDragging && "opacity-40")}>
      <CardBody
        task={task}
        showProject={showProject}
        timeZone={timeZone}
        handle={
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Drag ${task.title}`}
            className="-ml-1 flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
        }
        statusControl={
          <TaskStatusMenu
            taskId={task.id}
            taskTitle={task.title}
            status={task.status}
            onChange={onStatusChange}
          />
        }
      />
    </div>
  )
}

function CardBody({
  task,
  showProject,
  timeZone,
  handle,
  statusControl,
  className,
}: {
  task: TaskListRow
  showProject: boolean
  timeZone: string
  handle?: React.ReactNode
  statusControl?: React.ReactNode
  className?: string
}) {
  return (
    <article
      className={cn("flex flex-col gap-2 rounded-lg border bg-card p-2.5 text-sm", className)}
    >
      <div className="flex items-start gap-1">
        {handle ?? (
          <span className="-ml-1 flex size-6 shrink-0 items-center justify-center text-muted-foreground">
            <GripVertical className="size-4" aria-hidden />
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
          <Link
            href={`/tasks/${task.id}`}
            className="leading-snug font-medium underline-offset-4 outline-none hover:underline focus-visible:underline"
          >
            {task.title}
          </Link>
          {showProject ? (
            <span className="truncate text-xs text-muted-foreground">{task.project?.name}</span>
          ) : null}
        </div>
      </div>
      {task.status === "blocked" && task.blocker_details ? (
        <p className="flex items-start gap-1 text-xs text-status-blocked">
          <CircleSlash className="mt-0.5 size-3 shrink-0" aria-hidden />
          <span className="line-clamp-2">{task.blocker_details}</span>
        </p>
      ) : null}
      <LabelChips labels={task.labels} max={2} />
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {statusControl}
        <PriorityBadge priority={task.priority} />
        {task.due_at ? (
          <DueDate dueAt={task.due_at} overdue={task.overdue} timeZone={timeZone} />
        ) : null}
      </div>
    </article>
  )
}

/** Arrow left/right jumps the dragged card to the neighbouring column. */
const columnKeyboardCoordinates: KeyboardCoordinateGetter = (
  event,
  { currentCoordinates, context: { droppableRects, droppableContainers, collisionRect } },
) => {
  if (event.code !== "ArrowRight" && event.code !== "ArrowLeft") return undefined
  event.preventDefault()
  if (!collisionRect) return undefined
  const centre = collisionRect.left + collisionRect.width / 2
  const rects = droppableContainers
    .getEnabled()
    .map((c) => droppableRects.get(c.id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .sort((a, b) => a.left - b.left)
  const target =
    event.code === "ArrowRight"
      ? rects.find((r) => r.left > centre)
      : [...rects].reverse().find((r) => r.left + r.width < centre)
  if (!target) return currentCoordinates
  return {
    x: currentCoordinates.x + (target.left + 8 - collisionRect.left),
    y: currentCoordinates.y,
  }
}
