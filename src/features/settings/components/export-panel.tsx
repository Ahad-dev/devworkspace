"use client"

import * as React from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { strToU8, zipSync } from "fflate"
import { FileArchive, FileJson, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import {
  attachmentPath,
  buildExport,
  documentMarkdown,
  documentPath,
  EXPORT_NOTICE,
  EXPORT_TABLES,
  exportFileName,
  type ExportDocument,
} from "../export"

const PAGE = 1000

/** Every row of one table the user can read (RLS), in a stable order. */
async function readAll(db: SupabaseClient, table: string, orderBy: string[], select = "*") {
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += PAGE) {
    let q = db.from(table).select(select)
    for (const col of orderBy) q = q.order(col)
    const { data, error } = await q.range(from, from + PAGE - 1)
    if (error) throw new Error(`Couldn't read ${table.replace(/_/g, " ")}`)
    rows.push(...((data ?? []) as unknown as Record<string, unknown>[]))
    if (!data || data.length < PAGE) return rows
  }
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * Data export (Spec FR-14; Plan P8.1). Built in the browser from the user's own rows, so large
 * workspaces never pass through a server function.
 */
export function ExportPanel() {
  const [busy, setBusy] = React.useState<"data" | "documents" | null>(null)
  const [progress, setProgress] = React.useState("")

  async function exportData() {
    setBusy("data")
    try {
      const db = createClient() as unknown as SupabaseClient
      const data: Record<string, Record<string, unknown>[]> = {}
      for (const { table, orderBy } of EXPORT_TABLES) {
        setProgress(`Reading ${table.replace(/_/g, " ")}…`)
        data[table] = await readAll(db, table, orderBy)
      }
      const at = new Date()
      const file = buildExport(data, at)
      save(
        new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }),
        exportFileName("data", at),
      )
      const total = Object.values(file.counts).reduce((a, b) => a + b, 0)
      toast.success(`Exported ${total.toLocaleString("en")} records`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed. Try again.")
    } finally {
      setBusy(null)
      setProgress("")
    }
  }

  async function exportDocuments() {
    setBusy("documents")
    try {
      const db = createClient() as unknown as SupabaseClient
      setProgress("Reading documents…")
      const docs = (await readAll(
        db,
        "documents",
        ["id"],
        "id, title, category, summary, content_markdown, archived_at, created_at, updated_at, project:projects(name)",
      )) as unknown as ExportDocument[]
      const attachments = (await readAll(
        db,
        "document_attachments",
        ["id"],
        "document_id, storage_path, file_name",
      )) as {
        document_id: string
        storage_path: string
        file_name: string
      }[]
      const files: Record<string, Uint8Array> = {
        "README.txt": strToU8(`DevWorkspace documents export\n\n${EXPORT_NOTICE}\n`),
      }
      for (const doc of docs) files[documentPath(doc)] = strToU8(documentMarkdown(doc))

      const byId = new Map(docs.map((d) => [d.id, d]))
      let n = 0
      for (const att of attachments) {
        const doc = byId.get(att.document_id)
        if (!doc) continue
        n++
        setProgress(`Downloading file ${n} of ${attachments.length}…`)
        const { data, error } = await db.storage.from("attachments").download(att.storage_path)
        if (error || !data) throw new Error(`Couldn't download ${att.file_name}`)
        let path = attachmentPath(doc, att.file_name)
        for (let i = 2; files[path]; i++) path = attachmentPath(doc, `${i}-${att.file_name}`)
        files[path] = new Uint8Array(await data.arrayBuffer())
      }
      setProgress("Building the ZIP…")
      const at = new Date()
      const zipped = zipSync(files, { level: 6 })
      save(
        new Blob([zipped as BlobPart], { type: "application/zip" }),
        exportFileName("documents", at),
      )
      toast.success(`Exported ${docs.length} documents and ${n} files`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed. Try again.")
    } finally {
      setBusy(null)
      setProgress("")
    }
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy !== null} onClick={exportData}>
          {busy === "data" ? <Loader2 className="animate-spin" aria-hidden /> : <FileJson />}
          Download data (JSON)
        </Button>
        <Button size="sm" variant="outline" disabled={busy !== null} onClick={exportDocuments}>
          {busy === "documents" ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <FileArchive />
          )}
          Download documents (ZIP)
        </Button>
      </div>
      {progress ? (
        <p className="text-muted-foreground" role="status">
          {progress}
        </p>
      ) : null}
      <p className="text-muted-foreground">
        The JSON holds every record you own, with a schema version. The ZIP holds your documents as
        Markdown with their attached files. Neither contains secret values: DevWorkspace never
        stores them, and secrets in your vaults (Infisical, Doppler, 1Password) aren&apos;t exported
        from here.
      </p>
    </div>
  )
}
