"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { requireUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import {
  projectCreateSchema,
  projectUpdateSchema,
  repositorySchema,
  technologySchema,
  type FormState,
} from "./schemas"

/**
 * Server Actions for projects, repositories and technologies. Each one validates its input,
 * requires a signed-in user and writes as that user, so RLS and the database constraints remain
 * the final authority. Ids bound on the client are re-validated here.
 */

const uuid = z.uuid()

function fieldErrors(error: z.ZodError): FormState {
  return { status: "error", fieldErrors: z.flattenError(error).fieldErrors }
}

function dbError(
  error: { code?: string } | null,
  nameTaken = "That name is already used",
): FormState {
  switch (error?.code) {
    case "23505":
      return { status: "error", fieldErrors: { name: [nameTaken] } }
    case "23514":
      return {
        status: "error",
        message: "One of the values isn't allowed. Check the URLs and dates.",
      }
    case "23503":
      return {
        status: "error",
        message: "The related record no longer exists. Refresh and try again.",
      }
    default:
      return { status: "error", message: "Couldn't save. Try again." }
  }
}

function revalidateProject(projectId?: string) {
  revalidatePath("/projects")
  if (projectId) revalidatePath(`/projects/${projectId}`, "layout")
}

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "")

/* Projects ---------------------------------------------------------------- */

export async function createProject(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = projectCreateSchema.safeParse({
    name: text(formData, "name"),
    project_type: text(formData, "project_type"),
  })
  if (!parsed.success) return fieldErrors(parsed.error)

  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase.from("projects").insert(parsed.data).select("id").single()
  if (error || !data) return dbError(error, "You already have a project with that name")

  revalidateProject()
  redirect(`/projects/${data.id}`)
}

export async function updateProject(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!uuid.safeParse(projectId).success) return { status: "error", message: "Unknown project." }
  const parsed = projectUpdateSchema.safeParse({
    name: text(formData, "name"),
    project_type: text(formData, "project_type"),
    status: formData.has("status") ? text(formData, "status") : undefined,
    priority: text(formData, "priority") === "none" ? "" : text(formData, "priority"),
    description: text(formData, "description"),
    start_date: text(formData, "start_date"),
    target_date: text(formData, "target_date"),
    project_url: text(formData, "project_url"),
    documentation_url: text(formData, "documentation_url"),
    notes: text(formData, "notes"),
  })
  if (!parsed.success) return fieldErrors(parsed.error)

  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("projects")
    .update({
      ...parsed.data,
      status: parsed.data.status as "active" | "on_hold" | "maintenance" | "completed" | undefined,
    })
    .eq("id", projectId)
    .select("id")
  if (error) return dbError(error)
  if (!data?.length) return { status: "error", message: "Project not found." }

  revalidateProject(projectId)
  redirect(`/projects/${projectId}`)
}

async function setArchived(projectId: string, archived: boolean) {
  if (!uuid.safeParse(projectId).success) return
  await requireUser()
  const supabase = await createClient()
  await supabase
    .from("projects")
    .update({ status: archived ? "archived" : "active" })
    .eq("id", projectId)
  revalidateProject(projectId)
}

export async function archiveProject(projectId: string) {
  await setArchived(projectId, true)
}

export async function restoreProject(projectId: string) {
  await setArchived(projectId, false)
}

/** Used as a form action via useActionState(deleteProject.bind(null, id)); extra args are ignored. */
export async function deleteProject(projectId: string): Promise<FormState> {
  if (!uuid.safeParse(projectId).success) return { status: "error", message: "Unknown project." }
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase.from("projects").delete().eq("id", projectId).select("id")
  if (error) return { status: "error", message: "Couldn't delete the project. Try again." }
  if (!data?.length) return { status: "error", message: "Project not found." }
  revalidatePath("/projects")
  redirect("/projects")
}

/* Repositories ------------------------------------------------------------ */

function parseRepository(formData: FormData) {
  return repositorySchema.safeParse({
    name: text(formData, "name"),
    provider: text(formData, "provider"),
    purpose: text(formData, "purpose"),
    remote_url: text(formData, "remote_url"),
    default_branch: text(formData, "default_branch"),
    primary_language: text(formData, "primary_language"),
    local_path: text(formData, "local_path"),
    readme_url: text(formData, "readme_url"),
    notes: text(formData, "notes"),
  })
}

export async function createRepository(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!uuid.safeParse(projectId).success) return { status: "error", message: "Unknown project." }
  const parsed = parseRepository(formData)
  if (!parsed.success) return fieldErrors(parsed.error)

  await requireUser()
  const supabase = await createClient()
  const { error } = await supabase
    .from("repositories")
    .insert({ ...parsed.data, project_id: projectId })
  if (error) return dbError(error, "This project already has a repository with that name")

  revalidateProject(projectId)
  return { status: "success", message: "Repository added." }
}

export async function updateRepository(
  ids: { projectId: string; repositoryId: string },
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!uuid.safeParse(ids.projectId).success || !uuid.safeParse(ids.repositoryId).success) {
    return { status: "error", message: "Unknown repository." }
  }
  const parsed = parseRepository(formData)
  if (!parsed.success) return fieldErrors(parsed.error)

  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("repositories")
    .update(parsed.data)
    .eq("id", ids.repositoryId)
    .select("id")
  if (error) return dbError(error, "This project already has a repository with that name")
  if (!data?.length) return { status: "error", message: "Repository not found." }

  revalidateProject(ids.projectId)
  return { status: "success", message: "Repository saved." }
}

export async function deleteRepository(ids: { projectId: string; repositoryId: string }) {
  if (!uuid.safeParse(ids.projectId).success || !uuid.safeParse(ids.repositoryId).success) return
  await requireUser()
  const supabase = await createClient()
  await supabase.from("repositories").delete().eq("id", ids.repositoryId)
  revalidateProject(ids.projectId)
}

/* Technologies ------------------------------------------------------------ */

export async function addTechnology(
  projectId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!uuid.safeParse(projectId).success) return { status: "error", message: "Unknown project." }
  const parsed = technologySchema.safeParse({
    name: text(formData, "name"),
    category: text(formData, "category"),
    version: text(formData, "version"),
    repository_id: text(formData, "repository_id"),
  })
  if (!parsed.success) return fieldErrors(parsed.error)

  await requireUser()
  const supabase = await createClient()
  const { error } = await supabase
    .from("project_technologies")
    .insert({ ...parsed.data, project_id: projectId })
  if (error) return dbError(error, "Already in this project's stack")

  revalidateProject(projectId)
  return { status: "success", message: `Added ${parsed.data.name}.` }
}

export async function removeTechnology(ids: { projectId: string; technologyId: string }) {
  if (!uuid.safeParse(ids.projectId).success || !uuid.safeParse(ids.technologyId).success) return
  await requireUser()
  const supabase = await createClient()
  await supabase.from("project_technologies").delete().eq("id", ids.technologyId)
  revalidateProject(ids.projectId)
}
