"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { getMyProfile } from "@/features/profile/queries"
import type { FormState } from "@/features/projects/schemas"
import { requireUser } from "@/lib/auth/session"
import { PRIORITIES } from "@/lib/constants/domain"
import { createClient } from "@/lib/supabase/server"
import { endOfDayInZone } from "@/lib/timezones"
import {
  commentSchema,
  labelSchema,
  linkSchema,
  nextActionSchema,
  quickTaskSchema,
  statusChangeSchema,
  subtaskSchema,
  taskCreateSchema,
  taskUpdateSchema,
} from "./schemas"

/**
 * Server Actions for tasks (Spec FR-06; Plan P3.6–P3.10). Each validates its input, requires a
 * signed-in user and writes as that user: RLS, composite FKs, checks and triggers stay the final
 * authority. Ids bound on the client are re-validated here; owner_id is never sent.
 */

export type ActionResult = { ok: true } | { ok: false; error: string }

const uuid = z.uuid()
const isUuid = (v: unknown): v is string => uuid.safeParse(v).success
const text = (fd: FormData, key: string) => String(fd.get(key) ?? "")

type DbError = { code?: string; hint?: string } | null

function fieldErrors(error: z.ZodError): FormState {
  return { status: "error", fieldErrors: z.flattenError(error).fieldErrors }
}

function taskDbError(error: DbError): FormState {
  if (error?.code === "23514" && error.hint === "task_parent_cycle") {
    return {
      status: "error",
      fieldErrors: { parent_task_id: ["That parent is one of this task's own subtasks"] },
    }
  }
  switch (error?.code) {
    case "23514":
      return { status: "error", message: "One of the values isn't allowed. Check the fields." }
    case "23503":
      return {
        status: "error",
        message: "The project, repository or parent task doesn't match. Refresh and try again.",
      }
    default:
      return { status: "error", message: "Couldn't save the task. Try again." }
  }
}

function revalidateTask(projectId?: string | null, taskId?: string) {
  revalidatePath("/my-work")
  if (taskId) revalidatePath(`/tasks/${taskId}`, "layout")
  if (projectId) revalidatePath(`/projects/${projectId}`, "layout")
}

async function dueAt(date: string | null) {
  if (!date) return null
  const { timezone } = await getMyProfile()
  return endOfDayInZone(date, timezone)
}

/* Create --------------------------------------------------------------------- */

/** Quick capture: title + project, lands in Inbox (Plan §9 decision 1). */
export async function createQuickTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = quickTaskSchema.safeParse({
    title: text(formData, "title"),
    project_id: text(formData, "project_id"),
  })
  if (!parsed.success) return fieldErrors(parsed.error)

  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("tasks")
    .insert({ ...parsed.data, status: "inbox" })
    .select("id")
    .single()
  if (error || !data) return taskDbError(error)

  revalidateTask(parsed.data.project_id)
  return { status: "success", message: "Added to Inbox.", data: { id: data.id } }
}

function readTaskForm(formData: FormData) {
  return {
    title: text(formData, "title"),
    status: text(formData, "status"),
    priority: text(formData, "priority"),
    description: text(formData, "description"),
    next_action: text(formData, "next_action"),
    blocker_details: text(formData, "blocker_details"),
    due_date: text(formData, "due_date"),
    repository_id: text(formData, "repository_id"),
    parent_task_id: text(formData, "parent_task_id"),
    external_reference_url: text(formData, "external_reference_url"),
  }
}

/** Full form: defaults to Ready on the client (Plan §9 decision 1). */
export async function createTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = taskCreateSchema.safeParse({
    ...readTaskForm(formData),
    project_id: text(formData, "project_id"),
  })
  if (!parsed.success) return fieldErrors(parsed.error)

  await requireUser()
  const { due_date, ...fields } = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      ...fields,
      blocker_details: fields.status === "blocked" ? fields.blocker_details : null,
      due_at: await dueAt(due_date),
    })
    .select("id")
    .single()
  if (error || !data) return taskDbError(error)

  revalidateTask(fields.project_id)
  redirect(`/tasks/${data.id}`)
}

/* Update --------------------------------------------------------------------- */

export async function updateTask(
  taskId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isUuid(taskId)) return { status: "error", message: "Unknown task." }
  const parsed = taskUpdateSchema.safeParse(readTaskForm(formData))
  if (!parsed.success) return fieldErrors(parsed.error)

  await requireUser()
  const { due_date, ...fields } = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("tasks")
    .update({
      ...fields,
      // Only a blocked task keeps blocker details (the trigger also clears them on unblock).
      blocker_details: fields.status === "blocked" ? fields.blocker_details : null,
      due_at: await dueAt(due_date),
    })
    .eq("id", taskId)
    .select("id, project_id")
  if (error) return taskDbError(error)
  if (!data?.length) return { status: "error", message: "Task not found." }

  revalidateTask(data[0]?.project_id, taskId)
  redirect(`/tasks/${taskId}`)
}

/** Status change from the board, list menus and detail header. Blocked needs details. */
export async function changeTaskStatus(input: {
  taskId: string
  status: string
  blockerDetails?: string
}): Promise<ActionResult> {
  if (!isUuid(input.taskId)) return { ok: false, error: "Unknown task." }
  const parsed = statusChangeSchema.safeParse({
    status: input.status,
    blocker_details: input.blockerDetails ?? "",
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid status." }
  }

  await requireUser()
  const supabase = await createClient()
  const { status, blocker_details } = parsed.data
  const { data, error } = await supabase
    .from("tasks")
    .update(status === "blocked" ? { status, blocker_details } : { status })
    .eq("id", input.taskId)
    .select("project_id")
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23514"
          ? "Blocked tasks need blocker details."
          : "Couldn't change the status. Try again.",
    }
  }
  if (!data?.length) return { ok: false, error: "Task not found. Refresh and try again." }

  revalidateTask(data[0]?.project_id, input.taskId)
  return { ok: true }
}

export async function changeTaskPriority(input: {
  taskId: string
  priority: string
}): Promise<ActionResult> {
  const priority = z.enum(PRIORITIES).safeParse(input.priority)
  if (!isUuid(input.taskId) || !priority.success) return { ok: false, error: "Invalid priority." }

  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("tasks")
    .update({ priority: priority.data })
    .eq("id", input.taskId)
    .select("project_id")
  if (error || !data?.length) return { ok: false, error: "Couldn't change the priority." }

  revalidateTask(data[0]?.project_id, input.taskId)
  return { ok: true }
}

export async function saveNextAction(
  taskId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isUuid(taskId)) return { status: "error", message: "Unknown task." }
  const parsed = nextActionSchema.safeParse({ next_action: text(formData, "next_action") })
  if (!parsed.success) return fieldErrors(parsed.error)

  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("tasks")
    .update(parsed.data)
    .eq("id", taskId)
    .select("project_id")
  if (error || !data?.length) return { status: "error", message: "Couldn't save. Try again." }

  revalidateTask(data[0]?.project_id, taskId)
  return { status: "success", message: "Next action saved." }
}

/* Archive / delete ----------------------------------------------------------- */

export async function setTaskArchived(taskId: string, archived: boolean): Promise<ActionResult> {
  if (!isUuid(taskId)) return { ok: false, error: "Unknown task." }
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("tasks")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", taskId)
    .select("project_id")
  if (error || !data?.length) return { ok: false, error: "Couldn't update the task." }
  revalidateTask(data[0]?.project_id, taskId)
  return { ok: true }
}

/** Used as a form action via useActionState(deleteTask.bind(null, id)). */
export async function deleteTask(taskId: string): Promise<FormState> {
  if (!isUuid(taskId)) return { status: "error", message: "Unknown task." }
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .select("project_id")
  if (error?.code === "23503") {
    return {
      status: "error",
      message: "This task has subtasks. Delete or move them first, or archive the task instead.",
    }
  }
  if (error) return { status: "error", message: "Couldn't delete the task. Try again." }
  const projectId = data?.[0]?.project_id
  if (!projectId) return { status: "error", message: "Task not found." }

  revalidateTask(projectId)
  redirect(`/projects/${projectId}/tasks`)
}

/* Subtasks ------------------------------------------------------------------- */

async function projectOf(taskId: string) {
  const supabase = await createClient()
  const { data } = await supabase.from("tasks").select("project_id").eq("id", taskId).maybeSingle()
  return data?.project_id ?? null
}

export async function addSubtask(
  parentId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isUuid(parentId)) return { status: "error", message: "Unknown task." }
  const parsed = subtaskSchema.safeParse({ title: text(formData, "title") })
  if (!parsed.success) return fieldErrors(parsed.error)

  await requireUser()
  const projectId = await projectOf(parentId)
  if (!projectId) return { status: "error", message: "Task not found." }
  const supabase = await createClient()
  const { error } = await supabase.from("tasks").insert({
    title: parsed.data.title,
    project_id: projectId,
    parent_task_id: parentId,
    status: "inbox",
  })
  if (error) return taskDbError(error)

  revalidateTask(projectId, parentId)
  return { status: "success", message: "Subtask added." }
}

/* Dependencies --------------------------------------------------------------- */

export async function addDependency(
  taskId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const dependsOn = text(formData, "depends_on_task_id")
  if (!isUuid(taskId)) return { status: "error", message: "Unknown task." }
  if (!isUuid(dependsOn)) {
    return { status: "error", fieldErrors: { depends_on_task_id: ["Choose a task"] } }
  }

  await requireUser()
  const projectId = await projectOf(taskId)
  if (!projectId) return { status: "error", message: "Task not found." }
  const supabase = await createClient()
  const { error } = await supabase
    .from("task_dependencies")
    .insert({ task_id: taskId, depends_on_task_id: dependsOn, project_id: projectId })

  if (error) {
    const message =
      error.code === "23514" && error.hint === "task_dependency_cycle"
        ? "That would create a cycle: the other task already depends on this one, directly or through other tasks."
        : error.code === "23514"
          ? "A task can't depend on itself."
          : error.code === "23505"
            ? "This task already depends on that one."
            : error.code === "23503"
              ? "Choose a task from the same project."
              : "Couldn't add the dependency. Try again."
    return { status: "error", fieldErrors: { depends_on_task_id: [message] } }
  }

  revalidateTask(projectId, taskId)
  revalidatePath(`/tasks/${dependsOn}`)
  return { status: "success", message: "Dependency added." }
}

export async function removeDependency(ids: {
  taskId: string
  dependsOnId: string
}): Promise<ActionResult> {
  if (!isUuid(ids.taskId) || !isUuid(ids.dependsOnId)) return { ok: false, error: "Unknown task." }
  await requireUser()
  const supabase = await createClient()
  const { error } = await supabase
    .from("task_dependencies")
    .delete()
    .eq("task_id", ids.taskId)
    .eq("depends_on_task_id", ids.dependsOnId)
  if (error) return { ok: false, error: "Couldn't remove the dependency." }
  revalidatePath(`/tasks/${ids.taskId}`)
  revalidatePath(`/tasks/${ids.dependsOnId}`)
  return { ok: true }
}

/* Comments ------------------------------------------------------------------- */

export async function addComment(
  taskId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isUuid(taskId)) return { status: "error", message: "Unknown task." }
  const parsed = commentSchema.safeParse({ content: text(formData, "content") })
  if (!parsed.success) return fieldErrors(parsed.error)

  await requireUser()
  const supabase = await createClient()
  const { error } = await supabase
    .from("task_comments")
    .insert({ task_id: taskId, content: parsed.data.content })
  if (error) return { status: "error", message: "Couldn't add the comment. Try again." }

  revalidatePath(`/tasks/${taskId}`)
  return { status: "success", message: "Comment added." }
}

export async function deleteComment(ids: {
  taskId: string
  commentId: string
}): Promise<ActionResult> {
  if (!isUuid(ids.taskId) || !isUuid(ids.commentId)) return { ok: false, error: "Unknown comment." }
  await requireUser()
  const supabase = await createClient()
  const { error } = await supabase.from("task_comments").delete().eq("id", ids.commentId)
  if (error) return { ok: false, error: "Couldn't delete the comment." }
  revalidatePath(`/tasks/${ids.taskId}`)
  return { ok: true }
}

/* Links ---------------------------------------------------------------------- */

export async function addLink(
  taskId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isUuid(taskId)) return { status: "error", message: "Unknown task." }
  const parsed = linkSchema.safeParse({
    label: text(formData, "label"),
    url: text(formData, "url"),
  })
  if (!parsed.success) return fieldErrors(parsed.error)

  await requireUser()
  const supabase = await createClient()
  const { error } = await supabase.from("task_links").insert({ task_id: taskId, ...parsed.data })
  if (error) {
    return error.code === "23514"
      ? { status: "error", fieldErrors: { url: ["Enter an http(s) URL without credentials"] } }
      : { status: "error", message: "Couldn't add the link. Try again." }
  }

  revalidatePath(`/tasks/${taskId}`)
  return { status: "success", message: "Link added." }
}

export async function removeLink(ids: { taskId: string; linkId: string }): Promise<ActionResult> {
  if (!isUuid(ids.taskId) || !isUuid(ids.linkId)) return { ok: false, error: "Unknown link." }
  await requireUser()
  const supabase = await createClient()
  const { error } = await supabase.from("task_links").delete().eq("id", ids.linkId)
  if (error) return { ok: false, error: "Couldn't remove the link." }
  revalidatePath(`/tasks/${ids.taskId}`)
  return { ok: true }
}

/* Labels --------------------------------------------------------------------- */

/** Create a label and, when bound to a task, attach it straight away. */
export async function createLabel(
  taskId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (taskId !== null && !isUuid(taskId)) return { status: "error", message: "Unknown task." }
  const parsed = labelSchema.safeParse({
    name: text(formData, "name"),
    color: text(formData, "color"),
  })
  if (!parsed.success) return fieldErrors(parsed.error)

  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("task_labels")
    .insert(parsed.data)
    .select("id")
    .single()
  if (error?.code === "23505") {
    return { status: "error", fieldErrors: { name: ["You already have a label with that name"] } }
  }
  if (error || !data) return { status: "error", message: "Couldn't create the label." }

  if (taskId) {
    await supabase.from("task_label_links").insert({ task_id: taskId, label_id: data.id })
    revalidatePath(`/tasks/${taskId}`)
  }
  revalidatePath("/my-work")
  return {
    status: "success",
    message: `Label "${parsed.data.name}" created.`,
    data: { id: data.id },
  }
}

export async function setTaskLabel(input: {
  taskId: string
  labelId: string
  on: boolean
}): Promise<ActionResult> {
  if (!isUuid(input.taskId) || !isUuid(input.labelId)) return { ok: false, error: "Unknown label." }
  await requireUser()
  const supabase = await createClient()
  const { error } = input.on
    ? await supabase
        .from("task_label_links")
        .insert({ task_id: input.taskId, label_id: input.labelId })
    : await supabase
        .from("task_label_links")
        .delete()
        .eq("task_id", input.taskId)
        .eq("label_id", input.labelId)
  // 23505: already attached, which is the state we wanted.
  if (error && error.code !== "23505") return { ok: false, error: "Couldn't update labels." }
  revalidatePath(`/tasks/${input.taskId}`)
  revalidatePath("/my-work")
  return { ok: true }
}

/* Reads for client dialogs ---------------------------------------------------- */

/** Project choices for the header's quick capture (loaded when the dialog opens). */
export async function loadProjectOptions(): Promise<{ id: string; name: string }[]> {
  await requireUser()
  const supabase = await createClient()
  const { data } = await supabase
    .from("projects")
    .select("id, name")
    .neq("status", "archived")
    .order("name")
  return data ?? []
}
