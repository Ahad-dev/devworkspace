"use server"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import type { FormState } from "@/features/projects/schemas"
import { requireUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import {
  attachmentRequestSchema,
  commandSchema,
  documentCreateSchema,
  documentUpdateSchema,
  type DocumentUpdateInput,
} from "./schemas"
import { attachmentStoragePath } from "./utils"

/**
 * Document, attachment and command actions (Spec FR-10, FR-11, §9.4; Plan P6.2–P6.6). Each one
 * validates, requires a signed-in user and writes as that user, so RLS, composite FKs, the
 * no-secret domain and the Storage policies stay the final authority.
 *
 * Attachments: the server picks the path and registers it, then the browser uploads the file to
 * exactly that path (Storage only accepts registered paths in the owner's folder). Downloads get
 * a 60-second signed URL that forces a download. Objects are removed here when their rows go.
 */

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string; fieldErrors?: Partial<Record<string, string[]>> }

const BUCKET = "attachments"
const uuid = z.uuid()
const isUuid = (v: unknown): v is string => uuid.safeParse(v).success
const text = (fd: FormData, key: string) => String(fd.get(key) ?? "")
const bool = (fd: FormData, key: string) => fd.get(key) === "on" || fd.get(key) === "true"

function dbMessage(error: { code?: string } | null): string {
  switch (error?.code) {
    case "23514":
      return "Something here isn't allowed: remove anything that looks like a key, token or password (use a placeholder like $DATABASE_URL)."
    case "23503":
      return "The project, repository, environment or task doesn't match. Refresh and try again."
    case "42501":
      return "You don't have access to change that."
    default:
      return "Couldn't save. Try again."
  }
}

function revalidateKnowledge(projectId?: string | null, documentId?: string) {
  revalidatePath("/knowledge", "layout")
  if (projectId) revalidatePath(`/projects/${projectId}`, "layout")
  if (documentId) revalidatePath(`/knowledge/documents/${documentId}`, "layout")
}

/** Best effort: a leftover object is unreachable without its row, but log it for cleanup. */
async function removeObjects(paths: string[]) {
  if (!paths.length) return
  const supabase = await createClient()
  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) console.error("attachments: couldn't remove objects", { count: paths.length })
}

/* Documents -------------------------------------------------------------------- */

export async function createDocument(
  defaults: { projectId?: string | null },
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = documentCreateSchema.safeParse({
    title: text(formData, "title"),
    category: text(formData, "category"),
    project_id: formData.has("project_id")
      ? text(formData, "project_id")
      : (defaults.projectId ?? ""),
  })
  if (!parsed.success) {
    return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase.from("documents").insert(parsed.data).select("id").single()
  if (error || !data) return { status: "error", message: dbMessage(error) }

  revalidateKnowledge(parsed.data.project_id)
  redirect(`/knowledge/documents/${data.id}/edit`)
}

/** Explicit save from the editor (Ctrl/Cmd+S or the Save button). */
export async function saveDocument(
  documentId: string,
  input: DocumentUpdateInput,
): Promise<ActionResult<{ updatedAt: string }>> {
  if (!isUuid(documentId)) return { ok: false, error: "Unknown document." }
  const parsed = documentUpdateSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    }
  }

  await requireUser()
  const supabase = await createClient()
  const { data: before } = await supabase
    .from("documents")
    .select("project_id, archived_at")
    .eq("id", documentId)
    .maybeSingle()
  if (!before) return { ok: false, error: "Document not found." }
  if (before.archived_at) return { ok: false, error: "Restore the document before editing it." }

  const { data, error } = await supabase
    .from("documents")
    .update(parsed.data)
    .eq("id", documentId)
    .select("updated_at")
    .single()
  if (error || !data) return { ok: false, error: dbMessage(error) }

  revalidateKnowledge(parsed.data.project_id, documentId)
  if (before.project_id && before.project_id !== parsed.data.project_id) {
    revalidatePath(`/projects/${before.project_id}`, "layout")
  }
  return { ok: true, data: { updatedAt: data.updated_at } }
}

export async function setDocumentArchived(
  documentId: string,
  archived: boolean,
): Promise<ActionResult> {
  if (!isUuid(documentId)) return { ok: false, error: "Unknown document." }
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("documents")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", documentId)
    .select("project_id")
    .maybeSingle()
  if (error) return { ok: false, error: dbMessage(error) }
  if (!data) return { ok: false, error: "Document not found." }
  revalidateKnowledge(data.project_id, documentId)
  return { ok: true }
}

/** Deletes the document, its attachment rows and their files, then leaves the page. */
export async function deleteDocument(documentId: string): Promise<FormState> {
  if (!isUuid(documentId)) return { status: "error", message: "Unknown document." }
  await requireUser()
  const supabase = await createClient()
  const { data: doc } = await supabase
    .from("documents")
    .select("project_id, document_attachments(storage_path)")
    .eq("id", documentId)
    .maybeSingle()
  if (!doc) return { status: "error", message: "Document not found." }

  const { error } = await supabase.from("documents").delete().eq("id", documentId)
  if (error) return { status: "error", message: "Couldn't delete the document. Try again." }
  await removeObjects(doc.document_attachments.map((a) => a.storage_path))

  revalidateKnowledge(doc.project_id)
  redirect(doc.project_id ? `/projects/${doc.project_id}/documentation` : "/knowledge")
}

export async function linkDocumentTask(documentId: string, taskId: string): Promise<ActionResult> {
  if (!isUuid(documentId) || !isUuid(taskId)) return { ok: false, error: "Choose a task." }
  await requireUser()
  const supabase = await createClient()
  const { error } = await supabase
    .from("task_document_links")
    .insert({ document_id: documentId, task_id: taskId })
  if (error?.code === "23505") return { ok: false, error: "That task is already linked." }
  if (error) return { ok: false, error: dbMessage(error) }
  revalidateKnowledge(null, documentId)
  revalidatePath(`/tasks/${taskId}`)
  return { ok: true }
}

export async function unlinkDocumentTask(
  documentId: string,
  taskId: string,
): Promise<ActionResult> {
  if (!isUuid(documentId) || !isUuid(taskId)) return { ok: false, error: "Unknown task." }
  await requireUser()
  const supabase = await createClient()
  const { error } = await supabase
    .from("task_document_links")
    .delete()
    .eq("document_id", documentId)
    .eq("task_id", taskId)
  if (error) return { ok: false, error: dbMessage(error) }
  revalidateKnowledge(null, documentId)
  revalidatePath(`/tasks/${taskId}`)
  return { ok: true }
}

/* Attachments ------------------------------------------------------------------ */

/** Step 1 of an upload: validate and register the file; the browser then uploads to `path`. */
export async function requestAttachmentUpload(input: {
  document_id: string
  file_name: string
  size_bytes: number
}): Promise<ActionResult<{ id: string; path: string; mimeType: string }>> {
  const parsed = attachmentRequestSchema.safeParse(input)
  if (!parsed.success) {
    const first = z.flattenError(parsed.error)
    const message =
      Object.values(first.fieldErrors).flat()[0] ?? first.formErrors[0] ?? "Choose a file."
    return { ok: false, error: message }
  }

  const user = await requireUser()
  const supabase = await createClient()
  const { data: doc } = await supabase
    .from("documents")
    .select("id, archived_at")
    .eq("id", parsed.data.document_id)
    .maybeSingle()
  if (!doc) return { ok: false, error: "Document not found." }
  if (doc.archived_at) return { ok: false, error: "Restore the document to add files." }

  const path = attachmentStoragePath(user.id, doc.id, randomUUID(), parsed.data.file_name)
  const { data, error } = await supabase
    .from("document_attachments")
    .insert({
      document_id: doc.id,
      storage_path: path,
      file_name: parsed.data.file_name,
      mime_type: parsed.data.mime_type,
      size_bytes: parsed.data.size_bytes,
    })
    .select("id")
    .single()
  if (error || !data) return { ok: false, error: dbMessage(error) }
  return { ok: true, data: { id: data.id, path, mimeType: parsed.data.mime_type } }
}

/** Step 2: refresh the document once the browser has uploaded the file. */
export async function finishAttachmentUpload(attachmentId: string): Promise<ActionResult> {
  if (!isUuid(attachmentId)) return { ok: false, error: "Unknown file." }
  await requireUser()
  const supabase = await createClient()
  const { data } = await supabase
    .from("document_attachments")
    .select("document_id, document:documents(project_id)")
    .eq("id", attachmentId)
    .maybeSingle()
  if (!data) return { ok: false, error: "File not found." }
  revalidateKnowledge(data.document?.project_id, data.document_id)
  return { ok: true }
}

/** Removes an attachment: its row, then its file. Also used when an upload fails. */
export async function removeAttachment(attachmentId: string): Promise<ActionResult> {
  if (!isUuid(attachmentId)) return { ok: false, error: "Unknown file." }
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("document_attachments")
    .delete()
    .eq("id", attachmentId)
    .select("storage_path, document_id")
    .maybeSingle()
  if (error) return { ok: false, error: "Couldn't remove the file. Try again." }
  if (!data) return { ok: false, error: "File not found." }
  await removeObjects([data.storage_path])
  revalidateKnowledge(null, data.document_id)
  return { ok: true }
}

/** A 60-second signed download URL for the owner's file (Plan P6.2). */
export async function getAttachmentDownloadUrl(
  attachmentId: string,
): Promise<ActionResult<{ url: string }>> {
  if (!isUuid(attachmentId)) return { ok: false, error: "Unknown file." }
  await requireUser()
  const supabase = await createClient()
  const { data: row } = await supabase
    .from("document_attachments")
    .select("storage_path, file_name")
    .eq("id", attachmentId)
    .maybeSingle()
  if (!row) return { ok: false, error: "File not found." }
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, 60, { download: row.file_name })
  if (error || !data) return { ok: false, error: "Couldn't prepare the download. Try again." }
  return { ok: true, data: { url: data.signedUrl } }
}

/* Commands --------------------------------------------------------------------- */

function parseCommand(formData: FormData) {
  return commandSchema.safeParse({
    title: text(formData, "title"),
    command_text: text(formData, "command_text"),
    description: text(formData, "description"),
    shell: text(formData, "shell"),
    operating_system: text(formData, "operating_system"),
    category: text(formData, "category"),
    prerequisites: text(formData, "prerequisites"),
    is_destructive: bool(formData, "is_destructive"),
    project_id: text(formData, "project_id"),
    repository_id: text(formData, "repository_id"),
    environment_id: text(formData, "environment_id"),
  })
}

export async function saveCommand(
  commandId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (commandId !== null && !isUuid(commandId)) {
    return { status: "error", message: "Unknown command." }
  }
  const parsed = parseCommand(formData)
  if (!parsed.success) {
    return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  await requireUser()
  const supabase = await createClient()
  let previousProject: string | null = null
  if (commandId) {
    const { data: before } = await supabase
      .from("command_snippets")
      .select("project_id")
      .eq("id", commandId)
      .maybeSingle()
    if (!before) return { status: "error", message: "Command not found." }
    previousProject = before.project_id
    const { error } = await supabase
      .from("command_snippets")
      .update(parsed.data)
      .eq("id", commandId)
    if (error) return { status: "error", message: dbMessage(error) }
  } else {
    const { error } = await supabase.from("command_snippets").insert(parsed.data)
    if (error) return { status: "error", message: dbMessage(error) }
  }

  revalidateKnowledge(parsed.data.project_id)
  if (previousProject && previousProject !== parsed.data.project_id) {
    revalidatePath(`/projects/${previousProject}`, "layout")
  }
  return { status: "success", message: commandId ? "Command saved." : "Command added." }
}

export async function deleteCommand(commandId: string): Promise<ActionResult> {
  if (!isUuid(commandId)) return { ok: false, error: "Unknown command." }
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("command_snippets")
    .delete()
    .eq("id", commandId)
    .select("project_id")
    .maybeSingle()
  if (error) return { ok: false, error: "Couldn't delete the command. Try again." }
  if (!data) return { ok: false, error: "Command not found." }
  revalidateKnowledge(data.project_id)
  return { ok: true }
}
