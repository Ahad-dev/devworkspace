"use client"

import * as React from "react"
import { CloudOff, Loader2, RefreshCw, SquareTerminal, WifiOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { isServerReachable } from "@/lib/offline/connectivity"
import {
  isKeepCopyEnabled,
  onOfflineChange,
  readStoredCopy,
  wipeOfflineData,
} from "@/lib/offline/store"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { isSnapshotUsable, type OfflineSnapshot } from "../snapshot"
import {
  projectsWithTasks,
  QUEUE_VIEW_LABELS,
  QUEUE_VIEWS,
  resolveOfflineView,
  selectProjectTasks,
  selectQueue,
  selectTaskDetail,
  type OfflineView,
} from "../views"
import { OfflineTaskDetail } from "./offline-task-detail"
import { OfflineTaskTable } from "./offline-task-table"

type CopyState =
  | { status: "loading" }
  | { status: "none"; keep: boolean }
  | { status: "ready"; copy: OfflineSnapshot; now: Date }

const noSubscribe = () => () => {}

/**
 * The offline app (Plan P9.4): a read-only view of this device's saved copy of tasks. The service
 * worker serves this page in place of any page that can't load, so the view follows the address
 * bar, read only in the browser (the prerendered HTML is the same for every URL and holds no data).
 * When the server answers again, a fallback page reloads into the live one.
 */
export function OfflineApp() {
  const href = React.useSyncExternalStore(
    noSubscribe,
    () => window.location.href,
    () => null,
  )
  const [state, setState] = React.useState<CopyState>({ status: "loading" })
  const [checking, setChecking] = React.useState(false)
  const [message, setMessage] = React.useState("")

  React.useEffect(() => {
    let cancelled = false
    const load = async () => {
      const value = await readStoredCopy()
      if (cancelled) return
      if (isSnapshotUsable(value)) {
        // "Now" for overdue flags is taken when the copy is read, never during prerendering.
        setState({ status: "ready", copy: value, now: new Date() })
      } else {
        // Expired, from an older version, or nothing saved: show nothing and keep nothing.
        if (value) void wipeOfflineData()
        setState({ status: "none", keep: isKeepCopyEnabled() })
      }
    }
    void load()
    const unsubscribe = onOfflineChange(() => void load())
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const isFallback = href ? new URL(href).pathname !== "/offline" : false

  const retry = React.useCallback(
    async (quiet: boolean) => {
      if (!quiet) {
        setChecking(true)
        setMessage("")
      }
      const reachable = navigator.onLine && (await isServerReachable())
      if (reachable) {
        window.location.assign(isFallback ? window.location.href : "/my-work")
        return
      }
      if (!quiet) {
        setChecking(false)
        setMessage("Still offline. Your saved copy stays available.")
      }
    },
    [isFallback],
  )

  // Back online: return to the live page by itself, but only from a fallback page.
  React.useEffect(() => {
    if (!isFallback) return
    const check = () => {
      if (document.visibilityState === "visible") void retry(true)
    }
    window.addEventListener("online", check)
    window.addEventListener("pageshow", check)
    document.addEventListener("visibilitychange", check)
    return () => {
      window.removeEventListener("online", check)
      window.removeEventListener("pageshow", check)
      document.removeEventListener("visibilitychange", check)
    }
  }, [isFallback, retry])

  const view: OfflineView | null = React.useMemo(
    () => (href ? resolveOfflineView(href) : null),
    [href],
  )

  React.useEffect(() => {
    if (!view || state.status !== "ready") return
    const task = view.kind === "task" ? selectTaskDetail(state.copy, view.taskId)?.task : null
    document.title = `${task ? task.title : "Offline"} · DevWorkspace`
  }, [view, state])

  return (
    <div className="flex min-h-svh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm font-medium shadow focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:ring-3 focus:ring-ring/50"
      >
        Skip to main content
      </a>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3">
        <a href="/my-work" className="flex items-center gap-2 font-semibold">
          <SquareTerminal className="size-5" aria-hidden />
          DevWorkspace
        </a>
        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
          <WifiOff className="size-3.5" aria-hidden />
          Offline
        </span>
        <p className="text-sm text-muted-foreground" role="status">
          {state.status === "ready"
            ? `Saved copy from ${formatDateTime(state.copy.syncedAt, state.copy.timeZone)}. Editing needs a connection.`
            : "Editing needs a connection."}
        </p>
        <div className="ms-auto flex items-center gap-2">
          {message ? (
            <span className="text-sm text-muted-foreground" role="status">
              {message}
            </span>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => void retry(false)} disabled={checking}>
            {checking ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <RefreshCw aria-hidden />
            )}
            Try again
          </Button>
        </div>
      </header>

      {state.status === "loading" || !view ? (
        <div className="flex flex-col gap-4 p-4 md:p-6" aria-busy="true">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : state.status === "none" ? (
        <main id="main" tabIndex={-1} className="flex flex-1 p-4 outline-none md:p-6">
          <NoCopy keep={state.keep} />
        </main>
      ) : (
        <div className="grid flex-1 md:grid-cols-[14rem_minmax(0,1fr)]">
          <OfflineNav copy={state.copy} view={view} />
          <main
            id="main"
            tabIndex={-1}
            className="flex min-w-0 flex-col gap-6 p-4 outline-none md:p-6"
          >
            <OfflineContent copy={state.copy} view={view} now={state.now} />
          </main>
        </div>
      )}
    </div>
  )
}

function OfflineNav({ copy, view }: { copy: OfflineSnapshot; view: OfflineView }) {
  const projects = projectsWithTasks(copy)
  const item = (active: boolean) =>
    cn(
      "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted",
      active && "bg-muted font-medium",
    )
  return (
    <nav
      aria-label="Saved copy"
      className="flex flex-col gap-4 border-b p-3 md:border-r md:border-b-0"
    >
      <div className="flex flex-col gap-0.5">
        <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">My work</p>
        {QUEUE_VIEWS.map((v) => (
          <a
            key={v}
            href={v === "all" ? "/my-work" : `/my-work?view=${v}`}
            className={item(view.kind === "queue" && view.view === v)}
            aria-current={view.kind === "queue" && view.view === v ? "page" : undefined}
          >
            {QUEUE_VIEW_LABELS[v]}
          </a>
        ))}
      </div>
      {projects.length ? (
        <div className="flex flex-col gap-0.5">
          <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">Projects</p>
          {projects.map((p) => {
            const active = view.kind === "project" && view.projectId === p.id
            return (
              <a
                key={p.id}
                href={`/projects/${p.id}/tasks`}
                className={item(active)}
                aria-current={active ? "page" : undefined}
              >
                <span className="truncate">{p.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{p.open}</span>
              </a>
            )
          })}
        </div>
      ) : null}
    </nav>
  )
}

function OfflineContent({
  copy,
  view,
  now,
}: {
  copy: OfflineSnapshot
  view: OfflineView
  now: Date
}) {
  const tz = copy.timeZone
  if (view.kind === "task") {
    const detail = selectTaskDetail(copy, view.taskId)
    if (!detail) {
      return (
        <Missing
          title="This task isn't in the saved copy"
          description="It may be archived, completed more than two weeks ago, or created after the copy was saved."
        />
      )
    }
    return <OfflineTaskDetail detail={detail} editing={view.editing} timeZone={tz} now={now} />
  }

  if (view.kind === "project") {
    const { project, open, done } = selectProjectTasks(copy, view.projectId)
    if (!project) {
      return (
        <Missing
          title="This project isn't in the saved copy"
          description="Projects are saved with their tasks. Open it again when you're back online."
        />
      )
    }
    return (
      <>
        <Heading title={project.name} description={`${open.length} open tasks`} />
        <TaskSection tasks={open} empty="No open tasks." showProject={false} tz={tz} now={now} />
        {done.length ? (
          <section aria-labelledby="offline-done" className="flex flex-col gap-3">
            <h2 id="offline-done" className="text-base font-semibold">
              Recently completed
            </h2>
            <TaskSection tasks={done} empty="" showProject={false} tz={tz} now={now} />
          </section>
        ) : null}
      </>
    )
  }

  const queueView = view.kind === "queue" ? view.view : "all"
  const tasks = selectQueue(copy, queueView)
  return (
    <>
      {view.kind === "unavailable" ? (
        <p className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <CloudOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          This page isn&apos;t in the saved copy: only tasks are kept on this device. It loads again
          when you&apos;re back online.
        </p>
      ) : null}
      <Heading
        title={`My work: ${QUEUE_VIEW_LABELS[queueView]}`}
        description={
          copy.truncated
            ? `${tasks.length} tasks. The copy holds your ${copy.tasks.length} highest-priority tasks.`
            : `${tasks.length} tasks`
        }
      />
      <TaskSection tasks={tasks} empty="Nothing here." showProject tz={tz} now={now} />
    </>
  )
}

function Heading({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function TaskSection({
  tasks,
  empty,
  showProject,
  tz,
  now,
}: {
  tasks: OfflineSnapshot["tasks"]
  empty: string
  showProject: boolean
  tz: string
  now: Date
}) {
  if (!tasks.length) return <p className="text-sm text-muted-foreground">{empty}</p>
  return <OfflineTaskTable tasks={tasks} showProject={showProject} timeZone={tz} now={now} />
}

function Missing({ title, description }: { title: string; description: string }) {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CloudOff />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <a href="/my-work" className="text-sm underline underline-offset-4">
        Back to My work
      </a>
    </Empty>
  )
}

function NoCopy({ keep }: { keep: boolean }) {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CloudOff />
        </EmptyMedia>
        <h1 className="text-lg font-medium">No saved copy on this device</h1>
        <EmptyDescription>
          {keep
            ? "Open DevWorkspace while you're online and signed in: your tasks are saved on this device automatically, and you can read them here without a connection."
            : "Keeping a copy is turned off for this device (Settings → This device)."}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
