import { describe, expect, it } from "vitest"

import {
  attachmentPath,
  buildExport,
  documentMarkdown,
  documentPath,
  EXPORT_SCHEMA_VERSION,
  EXPORT_TABLES,
  exportFileName,
} from "@/features/settings/export"
import {
  DEFAULT_TASK_VIEW,
  parseTaskFilters,
  parseTaskViewPreference,
} from "@/features/tasks/utils"
import type { Database } from "@/types/database.types"

/** Phase 8 (Spec FR-14, §6.11; Plan P8.1): export files and the default task view. */

describe("data export", () => {
  it("covers every table in the schema exactly once", () => {
    const tables: (keyof Database["public"]["Tables"])[] = [
      "account_secrets",
      "accounts",
      "activity_events",
      "command_snippets",
      "document_attachments",
      "documents",
      "environment_variables",
      "environments",
      "profiles",
      "project_services",
      "project_technologies",
      "projects",
      "repositories",
      "secret_references",
      "service_instances",
      "task_comments",
      "task_dependencies",
      "task_document_links",
      "task_label_links",
      "task_labels",
      "task_links",
      "tasks",
      "vault_keys",
      "work_handoffs",
      "work_session_segments",
      "work_sessions",
    ]
    expect(EXPORT_TABLES.map((t) => t.table).sort()).toEqual([...tables].sort())
    // Parents come before the rows that point at them.
    const order = EXPORT_TABLES.map((t) => t.table)
    expect(order.indexOf("projects")).toBeLessThan(order.indexOf("tasks"))
    expect(order.indexOf("documents")).toBeLessThan(order.indexOf("document_attachments"))
    expect(order.indexOf("vault_keys")).toBeLessThan(order.indexOf("account_secrets"))
    expect(order.indexOf("accounts")).toBeLessThan(order.indexOf("project_services"))
  })

  it("builds a versioned file without derived columns", () => {
    const file = buildExport(
      {
        projects: [{ id: "p", name: "Portal" }],
        documents: [{ id: "d", title: "Runbook", search_vector: "'runbook':1A" }],
      },
      new Date("2026-11-20T10:00:00Z"),
    )
    expect(file.schema_version).toBe(EXPORT_SCHEMA_VERSION)
    expect(file.exported_at).toBe("2026-11-20T10:00:00.000Z")
    expect(file.counts).toEqual({ projects: 1, documents: 1 })
    expect(file.data.documents![0]).toEqual({ id: "d", title: "Runbook" })
    expect(file.notice).toMatch(/does not contain secret values/)
    expect(exportFileName("data", new Date("2026-11-20T10:00:00Z"))).toBe(
      "devworkspace-data-2026-11-20.json",
    )
  })

  it("writes documents as Markdown with front matter at safe paths", () => {
    const doc = {
      id: "5d1c9e7a-2b3f-4a6d-8e9f-0a1b2c3d4e5f",
      title: 'Prod "rollback" / runbook',
      category: "deployment",
      summary: null,
      content_markdown: "# Steps\n\n1. Promote",
      archived_at: null,
      created_at: "2026-11-01T00:00:00Z",
      updated_at: "2026-11-02T00:00:00Z",
      project: { name: "Client Portal" },
    }
    expect(documentPath(doc)).toBe(
      "documents/client-portal/prod-rollback-runbook-5d1c9e7a/prod-rollback-runbook.md",
    )
    const md = documentMarkdown(doc)
    expect(md.startsWith('---\ntitle: "Prod \\"rollback\\" / runbook"\n')).toBe(true)
    expect(md).toContain('project: "Client Portal"')
    expect(md).toContain("summary: null")
    expect(md.endsWith("# Steps\n\n1. Promote\n")).toBe(true)
    expect(attachmentPath({ ...doc, project: null }, "../../etc/passwd")).toBe(
      "documents/global/prod-rollback-runbook-5d1c9e7a/attachments/passwd",
    )
  })
})

describe("default task view", () => {
  it("reads preferences defensively", () => {
    expect(parseTaskViewPreference({ task_view: { layout: "board", sort: "due" } })).toEqual({
      layout: "board",
      sort: "due",
    })
    expect(parseTaskViewPreference({ task_view: { layout: "grid", sort: "chaos" } })).toEqual(
      DEFAULT_TASK_VIEW,
    )
    expect(parseTaskViewPreference(null)).toEqual(DEFAULT_TASK_VIEW)
    expect(parseTaskViewPreference("nope")).toEqual(DEFAULT_TASK_VIEW)
  })

  it("applies the default unless the URL says otherwise", () => {
    const board = { layout: "board" as const, sort: "due" as const }
    expect(parseTaskFilters({}, board)).toMatchObject({ layout: "board", sort: "due" })
    expect(parseTaskFilters({ layout: "list" }, board)).toMatchObject({ layout: "list" })
    expect(parseTaskFilters({ sort: "title" }, board)).toMatchObject({ sort: "title" })
    expect(parseTaskFilters({})).toMatchObject({ layout: "board", sort: "priority" })
    // A saved list preference still wins over the board default.
    expect(parseTaskViewPreference({ task_view: { layout: "list" } })).toMatchObject({
      layout: "list",
    })
  })
})
