import "server-only"

import { cache } from "react"
import { notFound } from "next/navigation"
import { z } from "zod"

import { requireUser } from "@/lib/auth/session"
import {
  COMMAND_CATEGORIES,
  DOC_CATEGORIES,
  type CommandCategory,
  type DocCategory,
} from "@/lib/constants/domain"
import { createClient } from "@/lib/supabase/server"
import { ilikeTerm } from "./utils"

/**
 * Knowledge-base reads (Spec FR-10, FR-11; Plan P6.4–P6.6). Everything runs as the signed-in
 * user under RLS; attachment files are only reachable through short-lived signed URLs created in
 * actions.ts.
 */

const isUuid = (v: string) => z.uuid().safeParse(v).success
const countOf = (rel: { count: number }[] | null | undefined) => rel?.[0]?.count ?? 0

export type KnowledgeTab = "documents" | "commands"

export type KnowledgeFilters = {
  tab: KnowledgeTab
  q: string
  /** A project id, "global" for items without a project, or null for all. */
  project: string | null
  docCategory: DocCategory | null
  commandCategory: CommandCategory | null
  view: "active" | "archived"
}

export function parseKnowledgeFilters(
  sp: Record<string, string | string[] | undefined>,
): KnowledgeFilters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k])?.toString() ?? ""
  const tab = one("tab") === "commands" ? "commands" : "documents"
  const category = one("category")
  const project = one("project")
  return {
    tab,
    q: one("q").trim().slice(0, 100),
    project: project === "global" || isUuid(project) ? project : null,
    docCategory: (DOC_CATEGORIES as readonly string[]).includes(category)
      ? (category as DocCategory)
      : null,
    commandCategory: (COMMAND_CATEGORIES as readonly string[]).includes(category)
      ? (category as CommandCategory)
      : null,
    view: one("view") === "archived" ? "archived" : "active",
  }
}

/** FTS on the generated search_vector, plus a substring match for identifiers like DB_URL. */
function searchFilter(q: string, columns: string[]) {
  const term = ilikeTerm(q)
  if (!term) return null
  return [
    `search_vector.wfts(english).${term}`,
    ...columns.map((c) => `${c}.ilike.%${term}%`),
  ].join(",")
}

/* Documents -------------------------------------------------------------------- */

const DOCUMENT_LIST_SELECT = `
  id, title, category, summary, archived_at, updated_at, project_id,
  project:projects(id, name),
  repository:repositories(id, name),
  environment:environments(id, name, environment_type),
  document_attachments(count)
`

export async function listDocuments(filters: KnowledgeFilters, scope: { projectId?: string } = {}) {
  await requireUser()
  const supabase = await createClient()
  let q = supabase.from("documents").select(DOCUMENT_LIST_SELECT).limit(200)
  const project = scope.projectId ?? filters.project
  if (project === "global") q = q.is("project_id", null)
  else if (project) q = q.eq("project_id", project)
  q = filters.view === "archived" ? q.not("archived_at", "is", null) : q.is("archived_at", null)
  if (filters.docCategory) q = q.eq("category", filters.docCategory)
  const search = filters.q ? searchFilter(filters.q, ["title"]) : null
  if (search) q = q.or(search)
  const { data, error } = await q.order("updated_at", { ascending: false })
  if (error) throw new Error("Couldn't load documents")
  return (data ?? []).map((d) => ({ ...d, attachmentCount: countOf(d.document_attachments) }))
}

export type DocumentListRow = Awaited<ReturnType<typeof listDocuments>>[number]

export const getDocument = cache(async (documentId: string) => {
  await requireUser()
  if (!isUuid(documentId)) notFound()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("documents")
    .select(
      `id, title, category, summary, content_markdown, archived_at, created_at, updated_at,
       project_id, repository_id, environment_id,
       project:projects(id, name),
       repository:repositories(id, name),
       environment:environments(id, name, environment_type)`,
    )
    .eq("id", documentId)
    .maybeSingle()
  if (error) throw new Error("Couldn't load the document")
  if (!data) notFound()
  return data
})

export type DocumentDetail = Awaited<ReturnType<typeof getDocument>>

export async function listDocumentAttachments(documentId: string) {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("document_attachments")
    .select("id, file_name, mime_type, size_bytes, created_at")
    .eq("document_id", documentId)
    .order("created_at")
  if (error) throw new Error("Couldn't load attachments")
  return data ?? []
}

export type AttachmentRow = Awaited<ReturnType<typeof listDocumentAttachments>>[number]

export async function listDocumentTasks(documentId: string) {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("task_document_links")
    .select("task:tasks(id, title, status, archived_at, project:projects(id, name))")
    .eq("document_id", documentId)
    .order("created_at")
  if (error) throw new Error("Couldn't load linked tasks")
  return (data ?? []).flatMap((l) => (l.task ? [l.task] : []))
}

/** Tasks a document may link to: the document's project, or any project for a global one. */
export async function listLinkableTasks(projectId: string | null) {
  await requireUser()
  const supabase = await createClient()
  let q = supabase
    .from("tasks")
    .select("id, title, status, project:projects(name)")
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(300)
  if (projectId) q = q.eq("project_id", projectId)
  const { data } = await q
  return data ?? []
}

/** Documents linked to a task (task detail page). */
export async function listTaskDocuments(taskId: string) {
  await requireUser()
  const supabase = await createClient()
  const { data } = await supabase
    .from("task_document_links")
    .select("document:documents(id, title, category, archived_at)")
    .eq("task_id", taskId)
    .order("created_at")
  return (data ?? []).flatMap((l) => (l.document ? [l.document] : []))
}

/* Commands --------------------------------------------------------------------- */

const COMMAND_LIST_SELECT = `
  id, title, command_text, description, shell, operating_system, category, prerequisites,
  is_destructive, updated_at, project_id, repository_id, environment_id,
  project:projects(id, name),
  repository:repositories(id, name),
  environment:environments(id, name, environment_type)
`

export async function listCommands(filters: KnowledgeFilters, scope: { projectId?: string } = {}) {
  await requireUser()
  const supabase = await createClient()
  let q = supabase.from("command_snippets").select(COMMAND_LIST_SELECT).limit(300)
  const project = scope.projectId ?? filters.project
  if (project === "global") q = q.is("project_id", null)
  else if (project) q = q.eq("project_id", project)
  if (filters.commandCategory) q = q.eq("category", filters.commandCategory)
  const search = filters.q ? searchFilter(filters.q, ["title", "command_text"]) : null
  if (search) q = q.or(search)
  const { data, error } = await q.order("title")
  if (error) throw new Error("Couldn't load commands")
  return data ?? []
}

export type CommandRow = Awaited<ReturnType<typeof listCommands>>[number]

/* Pickers ---------------------------------------------------------------------- */

/**
 * Projects, repositories and environments for the document and command forms. Small for one
 * person, so it's fetched once and filtered by project in the browser.
 */
export const listLinkOptions = cache(async () => {
  await requireUser()
  const supabase = await createClient()
  const [projects, repositories, environments] = await Promise.all([
    supabase.from("projects").select("id, name, status").order("name").limit(500),
    supabase.from("repositories").select("id, name, project_id").order("name").limit(1000),
    supabase
      .from("environments")
      .select("id, name, project_id, environment_type, status")
      .neq("status", "archived")
      .order("name")
      .limit(1000),
  ])
  return {
    // Archived projects stay in the list so an item that belongs to one keeps its project; the
    // forms only offer them when already selected.
    projects: projects.data ?? [],
    repositories: repositories.data ?? [],
    environments: environments.data ?? [],
  }
})

export type LinkOptions = Awaited<ReturnType<typeof listLinkOptions>>
