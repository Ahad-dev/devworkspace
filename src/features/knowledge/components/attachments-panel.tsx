"use client"

import * as React from "react"
import { Download, FileImage, FileText, Loader2, Paperclip, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { ATTACHMENT_MAX_BYTES } from "@/lib/constants/domain"
import { findSecrets } from "@/lib/security/secret-guard"
import { createClient } from "@/lib/supabase/client"
import {
  finishAttachmentUpload,
  getAttachmentDownloadUrl,
  removeAttachment,
  requestAttachmentUpload,
} from "../actions"
import type { AttachmentRow } from "../queries"
import { attachmentTypeFor, formatBytes, isTextAttachment } from "../utils"

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.log,.md,.csv,.json"

/** Checks done in the browser before anything is sent; the server and Storage repeat them. */
async function precheck(file: File): Promise<string | null> {
  const mime = attachmentTypeFor(file.name)
  if (!mime)
    return `${file.name}: allowed types are PDF, PNG, JPEG, WebP, GIF, TXT, LOG, MD, CSV and JSON.`
  if (file.size === 0) return `${file.name} is empty.`
  if (file.size > ATTACHMENT_MAX_BYTES) return `${file.name} is larger than 10 MB.`
  if (isTextAttachment(mime)) {
    const [finding] = findSecrets(await file.text())
    if (finding) {
      return `${file.name} looks like it contains ${finding.message}. Remove it (use a placeholder or a vault reference) and try again.`
    }
  }
  return null
}

/**
 * Private attachments (Spec FR-10, §9.4; Plan P6.2). Upload: the server registers a generated
 * path, then the file goes straight to the private bucket at that path. Download: a signed URL
 * that lives 60 seconds and always downloads.
 */
export function AttachmentsPanel({
  documentId,
  attachments,
  readOnly,
}: {
  documentId: string
  attachments: AttachmentRow[]
  readOnly?: boolean
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState<string | null>(null)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [removing, setRemoving] = React.useState<AttachmentRow | null>(null)

  async function upload(files: FileList | null) {
    if (!files?.length) return
    const supabase = createClient()
    for (const file of Array.from(files)) {
      const problem = await precheck(file)
      if (problem) {
        toast.error(problem)
        continue
      }
      setUploading(file.name)
      const r = await requestAttachmentUpload({
        document_id: documentId,
        file_name: file.name,
        size_bytes: file.size,
      })
      if (!r.ok) {
        toast.error(r.error)
        continue
      }
      const { error } = await supabase.storage
        .from("attachments")
        .upload(r.data.path, file, { contentType: r.data.mimeType, upsert: false })
      if (error) {
        await removeAttachment(r.data.id)
        toast.error(`Couldn't upload ${file.name}. Try again.`)
        continue
      }
      await finishAttachmentUpload(r.data.id)
      toast.success(`Attached ${file.name}`)
    }
    setUploading(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  async function download(a: AttachmentRow) {
    setBusyId(a.id)
    const r = await getAttachmentDownloadUrl(a.id)
    setBusyId(null)
    if (!r.ok) {
      toast.error(r.error)
      return
    }
    // A download response (Content-Disposition: attachment), so the page stays put.
    window.location.assign(r.data.url)
  }

  async function confirmRemove() {
    const target = removing
    if (!target) return
    setBusyId(target.id)
    const r = await removeAttachment(target.id)
    setBusyId(null)
    setRemoving(null)
    if (r.ok) toast.success(`Removed ${target.file_name}`)
    else toast.error(r.error)
  }

  return (
    <section aria-labelledby="attachments-heading" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id="attachments-heading" className="text-sm font-semibold">
          Attachments
        </h2>
        {!readOnly ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              multiple
              className="sr-only"
              aria-label="Choose files to attach"
              onChange={(e) => upload(e.currentTarget.files)}
              tabIndex={-1}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={Boolean(uploading)}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? <Loader2 className="animate-spin" aria-hidden /> : <Upload />}
              {uploading ? "Uploading…" : "Attach file"}
            </Button>
          </>
        ) : null}
      </div>

      {uploading ? (
        <p className="text-xs text-muted-foreground" role="status">
          Uploading {uploading}…
        </p>
      ) : null}

      {attachments.length === 0 ? (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Paperclip className="size-3.5" aria-hidden />
          No files. PDFs, images, text, CSV and JSON up to 10 MB. Private to you.
        </p>
      ) : (
        <ul className="divide-y rounded-md border" aria-label="Attached files">
          {attachments.map((a) => {
            const Icon = a.mime_type.startsWith("image/") ? FileImage : FileText
            return (
              <li key={a.id} className="flex items-center gap-2 px-2.5 py-1.5 text-sm">
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate" title={a.file_name}>
                  {a.file_name}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatBytes(a.size_bytes)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Download ${a.file_name}`}
                  disabled={busyId === a.id}
                  onClick={() => download(a)}
                >
                  {busyId === a.id ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <Download />
                  )}
                </Button>
                {!readOnly ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${a.file_name}`}
                    disabled={busyId === a.id}
                    onClick={() => setRemoving(a)}
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      <AlertDialog open={Boolean(removing)} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.file_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The file is deleted from storage. It can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={confirmRemove} disabled={Boolean(busyId)}>
              Remove file
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
