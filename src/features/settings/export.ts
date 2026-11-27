import { sanitizeFileName } from "@/features/knowledge/utils"
import type { Database } from "@/types/database.types"

/**
 * Data export (Spec FR-14, §9.6; Plan P8.1). The browser reads the signed-in user's rows straight
 * from Supabase (RLS decides what's theirs) and builds the files itself, so nothing large passes
 * through a server function. Secret values appear only as the Accounts vault's ciphertext (Plan P11.1),
 * exported encrypted: the file can be read only with the vault's master password or recovery key.
 */

// 2: adds the Accounts vault tables (vault_keys, accounts, account_secrets) and project_services.account_id.
export const EXPORT_SCHEMA_VERSION = 2

export const EXPORT_NOTICE =
  "This export contains your DevWorkspace records: names, statuses, notes and metadata. It does not contain secret values in readable form: passwords and keys kept in your DevWorkspace vault are included only encrypted (vault_keys, account_secrets), and can be read only with your master password or recovery key, so keep this file as safe as the vault. Anything held in external vaults such as Infisical, Doppler or 1Password is not included; secret references point to those vaults."

type TableName = keyof Database["public"]["Tables"]

/** Every table that holds the user's data, parents first, with a stable order for paging. */
export const EXPORT_TABLES: { table: TableName; orderBy: string[] }[] = [
  { table: "profiles", orderBy: ["id"] },
  { table: "vault_keys", orderBy: ["id"] },
  { table: "accounts", orderBy: ["id"] },
  { table: "account_secrets", orderBy: ["id"] },
  { table: "projects", orderBy: ["id"] },
  { table: "repositories", orderBy: ["id"] },
  { table: "project_technologies", orderBy: ["id"] },
  { table: "task_labels", orderBy: ["id"] },
  { table: "tasks", orderBy: ["id"] },
  { table: "task_links", orderBy: ["id"] },
  { table: "task_label_links", orderBy: ["task_id", "label_id"] },
  { table: "task_comments", orderBy: ["id"] },
  { table: "task_dependencies", orderBy: ["task_id", "depends_on_task_id"] },
  { table: "work_sessions", orderBy: ["id"] },
  { table: "work_session_segments", orderBy: ["id"] },
  { table: "work_handoffs", orderBy: ["id"] },
  { table: "environments", orderBy: ["id"] },
  { table: "project_services", orderBy: ["id"] },
  { table: "service_instances", orderBy: ["id"] },
  { table: "secret_references", orderBy: ["id"] },
  { table: "environment_variables", orderBy: ["id"] },
  { table: "documents", orderBy: ["id"] },
  { table: "document_attachments", orderBy: ["id"] },
  { table: "task_document_links", orderBy: ["task_id", "document_id"] },
  { table: "command_snippets", orderBy: ["id"] },
  { table: "activity_events", orderBy: ["id"] },
]

/** Generated columns are derived data: leave them out of the export. */
const DERIVED_COLUMNS = new Set(["search_vector"])

export function cleanRow(row: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(row).filter(([k]) => !DERIVED_COLUMNS.has(k)))
}

export type ExportFile = {
  schema_version: number
  app: "DevWorkspace"
  exported_at: string
  notice: string
  counts: Record<string, number>
  data: Record<string, Record<string, unknown>[]>
}

export function buildExport(
  data: Record<string, Record<string, unknown>[]>,
  exportedAt: Date,
): ExportFile {
  const cleaned = Object.fromEntries(
    Object.entries(data).map(([t, rows]) => [t, rows.map(cleanRow)]),
  )
  return {
    schema_version: EXPORT_SCHEMA_VERSION,
    app: "DevWorkspace",
    exported_at: exportedAt.toISOString(),
    notice: EXPORT_NOTICE,
    counts: Object.fromEntries(Object.entries(cleaned).map(([t, rows]) => [t, rows.length])),
    data: cleaned,
  }
}

/* Documents ZIP ---------------------------------------------------------------- */

export type ExportDocument = {
  id: string
  title: string
  category: string
  summary: string | null
  content_markdown: string
  archived_at: string | null
  created_at: string
  updated_at: string
  project: { name: string } | null
}

/** A folder-safe name. Slashes become spaces first: the sanitizer keeps only a path's last part. */
function slug(text: string) {
  const flat = text
    .toLowerCase()
    .replace(/[\\/]+/g, " ")
    .replace(/\.+/g, " ")
  return sanitizeFileName(flat).replace(/\./g, "-").slice(0, 60) || "untitled"
}

/** "documents/<project or global>/<title>-<id8>": unique and readable. */
export function documentFolder(doc: Pick<ExportDocument, "id" | "title" | "project">) {
  const project = doc.project ? slug(doc.project.name) : "global"
  return `documents/${project}/${slug(doc.title)}-${doc.id.slice(0, 8)}`
}

export function documentPath(doc: Pick<ExportDocument, "id" | "title" | "project">) {
  return `${documentFolder(doc)}/${slug(doc.title)}.md`
}

const yaml = (v: string | null) => (v === null ? "null" : JSON.stringify(v))

/** The document as Markdown with front matter (JSON-quoted strings are valid YAML). */
export function documentMarkdown(doc: ExportDocument) {
  const front = [
    "---",
    `title: ${yaml(doc.title)}`,
    `category: ${yaml(doc.category)}`,
    `project: ${yaml(doc.project?.name ?? null)}`,
    `summary: ${yaml(doc.summary)}`,
    `created_at: ${yaml(doc.created_at)}`,
    `updated_at: ${yaml(doc.updated_at)}`,
    `archived_at: ${yaml(doc.archived_at)}`,
    `devworkspace_id: ${yaml(doc.id)}`,
    "---",
    "",
  ]
  return `${front.join("\n")}${doc.content_markdown}\n`
}

export function attachmentPath(
  doc: Pick<ExportDocument, "id" | "title" | "project">,
  fileName: string,
) {
  return `${documentFolder(doc)}/attachments/${sanitizeFileName(fileName)}`
}

export function exportFileName(kind: "data" | "documents", at: Date) {
  const stamp = at.toISOString().slice(0, 10)
  return kind === "data" ? `devworkspace-data-${stamp}.json` : `devworkspace-documents-${stamp}.zip`
}
