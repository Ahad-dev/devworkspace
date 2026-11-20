"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import type { FormState } from "@/features/projects/schemas"
import { requireUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { endedAtSchema, handoffSchema, isEmptyHandoff, sessionDetailsSchema } from "./schemas"
import { sessionErrorMessage } from "./utils"

/**
 * Session actions (Spec FR-07; Plan P4.4–P4.7). Thin wrappers over the session RPCs, which hold
 * the rules (one running session, atomic completion, append-only handoffs). Inputs are validated
 * and screened for secrets here first.
 */

export type SessionResult =
  | { ok: true }
  | {
      ok: false
      error: string
      /** Set when another session is running: the UI offers to pause or finish it. */
      activeSessionId?: string
      fieldErrors?: Record<string, string[]>
    }

export type HandoffPayload = {
  completed_summary: string
  current_state: string
  remaining_work: string
  next_action: string
  blockers: string
  technical_notes: string
  related_links: { label: string; url: string }[]
}

const uuid = z.uuid()
const isUuid = (v: unknown): v is string => uuid.safeParse(v).success

function issues(error: z.ZodError): SessionResult {
  const fieldErrors: Record<string, string[]> = {}
  for (const i of error.issues) {
    const key = i.path.join(".") || "form"
    ;(fieldErrors[key] ??= []).push(i.message)
  }
  return { ok: false, error: "Check the highlighted fields.", fieldErrors }
}

function failed(error: { code?: string; hint?: string; details?: string } | null): SessionResult {
  return {
    ok: false,
    error: sessionErrorMessage(error),
    activeSessionId:
      error?.hint === "active_session_exists" && isUuid(error.details) ? error.details : undefined,
  }
}

// The header timer shows on every page, so session changes refresh the whole layout.
function revalidateAll() {
  revalidatePath("/", "layout")
}

function parseHandoff(input: HandoffPayload | null | undefined) {
  if (!input) return { ok: true as const, value: null }
  const parsed = handoffSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, result: issues(parsed.error) }
  return { ok: true as const, value: isEmptyHandoff(parsed.data) ? null : parsed.data }
}

function parseEndedAt(value: string | null | undefined) {
  const parsed = endedAtSchema.safeParse(value ?? "")
  if (!parsed.success) return { ok: false as const, result: issues(parsed.error) }
  return { ok: true as const, value: parsed.data }
}

/* Start / switch ------------------------------------------------------------- */

export async function startSession(input: { taskId: string }): Promise<SessionResult> {
  if (!isUuid(input.taskId)) return { ok: false, error: "Unknown task." }
  await requireUser()
  const supabase = await createClient()
  const { error } = await supabase.rpc("start_work_session", { p_task_id: input.taskId })
  if (error) return failed(error)
  revalidateAll()
  return { ok: true }
}

/** Pause or finish the running session, then start on this task (Spec: never overlap timers). */
export async function switchSessions(input: {
  activeSessionId: string
  mode: "pause" | "complete"
  /** Then either start a new session on this task… */
  taskId?: string
  /** …or resume this paused session. */
  resumeSessionId?: string
}): Promise<SessionResult> {
  const next = input.resumeSessionId ?? input.taskId
  if (!isUuid(input.activeSessionId) || !isUuid(next)) {
    return { ok: false, error: "Unknown session." }
  }
  await requireUser()
  const supabase = await createClient()
  const stop = await supabase.rpc(
    input.mode === "pause" ? "pause_work_session" : "complete_work_session",
    { p_session_id: input.activeSessionId },
  )
  // It may have stopped elsewhere in the meantime; that's fine.
  if (
    stop.error &&
    stop.error.hint !== "session_not_active" &&
    stop.error.hint !== "session_completed"
  ) {
    return failed(stop.error)
  }
  const { error } = input.resumeSessionId
    ? await supabase.rpc("resume_work_session", { p_session_id: input.resumeSessionId })
    : await supabase.rpc("start_work_session", { p_task_id: next })
  if (error) return failed(error)
  revalidateAll()
  return { ok: true }
}

/* Pause / resume / complete -------------------------------------------------- */

type StopInput = {
  sessionId: string
  handoff?: HandoffPayload | null
  endedAt?: string | null
  updateTaskNextAction?: boolean
}

async function stop(fn: "pause_work_session" | "complete_work_session", input: StopInput) {
  if (!isUuid(input.sessionId)) return { ok: false, error: "Unknown session." } as SessionResult
  const handoff = parseHandoff(input.handoff)
  if (!handoff.ok) return handoff.result
  const endedAt = parseEndedAt(input.endedAt)
  if (!endedAt.ok) return endedAt.result

  await requireUser()
  const supabase = await createClient()
  const { error } = await supabase.rpc(fn, {
    p_session_id: input.sessionId,
    p_ended_at: endedAt.value ?? undefined,
    p_handoff: handoff.value ?? undefined,
    p_update_task_next_action: input.updateTaskNextAction ?? true,
  })
  if (error) return failed(error)
  revalidateAll()
  return { ok: true } as SessionResult
}

export async function pauseSession(input: StopInput): Promise<SessionResult> {
  return stop("pause_work_session", input)
}

export async function completeSession(input: StopInput): Promise<SessionResult> {
  return stop("complete_work_session", input)
}

export async function resumeSession(input: { sessionId: string }): Promise<SessionResult> {
  if (!isUuid(input.sessionId)) return { ok: false, error: "Unknown session." }
  await requireUser()
  const supabase = await createClient()
  const { error } = await supabase.rpc("resume_work_session", { p_session_id: input.sessionId })
  if (error) return failed(error)
  revalidateAll()
  return { ok: true }
}

/** "Save progress": a handoff without pausing. */
export async function saveHandoff(input: {
  sessionId: string
  handoff: HandoffPayload
  updateTaskNextAction?: boolean
}): Promise<SessionResult> {
  if (!isUuid(input.sessionId)) return { ok: false, error: "Unknown session." }
  const handoff = parseHandoff(input.handoff)
  if (!handoff.ok) return handoff.result
  if (!handoff.value) return { ok: false, error: sessionErrorMessage({ hint: "empty_handoff" }) }

  await requireUser()
  const supabase = await createClient()
  const { error } = await supabase.rpc("save_work_handoff", {
    p_session_id: input.sessionId,
    p_handoff: handoff.value,
    p_update_task_next_action: input.updateTaskNextAction ?? true,
  })
  if (error) return failed(error)
  revalidateAll()
  return { ok: true }
}

/* Details -------------------------------------------------------------------- */

export async function updateSessionDetails(
  sessionId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isUuid(sessionId)) return { status: "error", message: "Unknown session." }
  const parsed = sessionDetailsSchema.safeParse({
    branch_name: String(formData.get("branch_name") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    repository_id: String(formData.get("repository_id") ?? ""),
  })
  if (!parsed.success) {
    return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("work_sessions")
    .update(parsed.data)
    .eq("id", sessionId)
    .select("id")
  if (error) return { status: "error", message: sessionErrorMessage(error) }
  if (!data?.length) return { status: "error", message: "Session not found." }
  revalidateAll()
  return { status: "success", message: "Session details saved." }
}

/* Quick-create --------------------------------------------------------------- */

/** Open tasks to start a session on (Plan P7.3), work in progress first. */
export async function loadStartableTasks(): Promise<
  { id: string; title: string; status: string; projectName: string }[]
> {
  await requireUser()
  const supabase = await createClient()
  const { data } = await supabase
    .from("tasks")
    .select("id, title, status, updated_at, project:projects(name)")
    .in("status", ["in_progress", "ready", "review", "blocked", "inbox"])
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(200)
  const rank: Record<string, number> = { in_progress: 0, ready: 1, review: 2, blocked: 3, inbox: 4 }
  return (data ?? [])
    .map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      projectName: t.project?.name ?? "",
    }))
    .sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9))
}
