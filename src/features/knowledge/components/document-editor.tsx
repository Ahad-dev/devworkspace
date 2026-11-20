"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Check, CircleDot, Loader2, Save, TriangleAlert } from "lucide-react"
import { toast } from "sonner"

import { Markdown } from "@/components/shared/markdown"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Textarea } from "@/components/ui/textarea"
import { FormMessage, toFieldErrors } from "@/features/auth/components/form-message"
import { DOC_CATEGORIES, DOC_CATEGORY_LABELS, type DocCategory } from "@/lib/constants/domain"
import { formatDateTime } from "@/lib/format"
import { secretMessage } from "@/lib/security/secret-guard"
import { cn } from "@/lib/utils"
import { saveDocument } from "../actions"
import type { DocumentDetail, LinkOptions } from "../queries"
import { LinkFields, type LinkValue } from "./link-fields"

type Draft = {
  title: string
  category: DocCategory
  summary: string
  content_markdown: string
} & LinkValue

const MAX_CONTENT = 100_000

function toDraft(doc: DocumentDetail): Draft {
  return {
    title: doc.title,
    category: doc.category,
    summary: doc.summary ?? "",
    content_markdown: doc.content_markdown,
    project_id: doc.project_id,
    repository_id: doc.repository_id,
    environment_id: doc.environment_id,
  }
}

const same = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b)

/** Internal links that would leave the editor through client-side navigation. */
function leavingLink(e: MouseEvent): HTMLAnchorElement | null {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
    return null
  }
  const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null
  if (!a || a.target === "_blank" || a.hasAttribute("download")) return null
  const url = new URL(a.href, window.location.href)
  if (url.origin !== window.location.origin) return null
  if (url.pathname === window.location.pathname && url.search === window.location.search)
    return null
  return a
}

/**
 * Markdown editor (Spec §6.10; Plan P6.5): write, preview or both side by side, explicit save
 * with the button or Ctrl/Cmd+S, a visible unsaved state, and a warning before leaving with
 * unsaved changes (reload, close, or a link in the app).
 */
export function DocumentEditor({
  doc,
  options,
  timeZone,
}: {
  doc: DocumentDetail
  options: LinkOptions
  timeZone: string
}) {
  const router = useRouter()
  const [draft, setDraft] = React.useState<Draft>(() => toDraft(doc))
  const [saved, setSaved] = React.useState<Draft>(() => toDraft(doc))
  const [savedAt, setSavedAt] = React.useState(doc.updated_at)
  const [errors, setErrors] = React.useState<Partial<Record<string, string[]>>>({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [mode, setMode] = React.useState<"write" | "preview" | "split">("write")
  const [saving, startSaving] = React.useTransition()
  const dirty = !same(draft, saved)
  const preview = React.useDeferredValue(draft.content_markdown)
  const contentWarning = secretMessage(draft.content_markdown)

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const save = React.useCallback(() => {
    if (saving) return
    const snapshot = draft
    startSaving(async () => {
      const r = await saveDocument(doc.id, {
        ...snapshot,
        project_id: snapshot.project_id ?? "",
        repository_id: snapshot.repository_id ?? "",
        environment_id: snapshot.environment_id ?? "",
      })
      if (r.ok) {
        setSaved(snapshot)
        setSavedAt(r.data.updatedAt)
        setErrors({})
        setFormError(null)
      } else {
        setErrors(r.fieldErrors ?? {})
        setFormError(r.error)
        toast.error(r.error)
      }
    })
  }, [doc.id, draft, saving])

  // Ctrl/Cmd+S saves instead of opening the browser's "Save page" dialog.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault()
        save()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [save])

  // Unsaved changes: warn on reload/close and on in-app links.
  React.useEffect(() => {
    if (!dirty) return
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ""
    }
    function onClick(e: MouseEvent) {
      if (!leavingLink(e)) return
      if (!window.confirm("You have unsaved changes. Leave without saving?")) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    document.addEventListener("click", onClick, true)
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      document.removeEventListener("click", onClick, true)
    }
  }, [dirty])

  const status = saving ? (
    <span className="inline-flex items-center gap-1.5">
      <Loader2 className="size-3.5 animate-spin" aria-hidden />
      Saving…
    </span>
  ) : dirty ? (
    <span className="inline-flex items-center gap-1.5 text-status-in-progress">
      <CircleDot className="size-3.5" aria-hidden />
      Unsaved changes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5">
      <Check className="size-3.5" aria-hidden />
      Saved · {formatDateTime(savedAt, timeZone)}
    </span>
  )

  return (
    <form
      className="flex min-w-0 flex-col gap-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <div className="sticky top-12 z-10 -mx-1 flex flex-wrap items-center justify-between gap-2 bg-background/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          {status}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              if (dirty && !window.confirm("You have unsaved changes. Leave without saving?"))
                return
              router.push(`/knowledge/documents/${doc.id}`)
            }}
          >
            {dirty ? "Cancel" : "Done"}
          </Button>
          <Button type="submit" size="sm" disabled={saving || !dirty}>
            {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Save />}
            Save
            <Kbd className="hidden sm:inline-flex">Ctrl S</Kbd>
          </Button>
        </div>
      </div>

      {formError ? <FormMessage status="error">{formError}</FormMessage> : null}

      <FieldGroup>
        <Field data-invalid={Boolean(errors.title)}>
          <FieldLabel htmlFor="doc-edit-title">Title</FieldLabel>
          <Input
            id="doc-edit-title"
            value={draft.title}
            onChange={(e) => set("title", e.target.value)}
            maxLength={300}
            aria-invalid={Boolean(errors.title)}
            className="text-base font-medium"
          />
          <FieldError errors={toFieldErrors(errors.title)} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={Boolean(errors.category)}>
            <FieldLabel htmlFor="doc-edit-category">Category</FieldLabel>
            <Select value={draft.category} onValueChange={(v) => set("category", v as DocCategory)}>
              <SelectTrigger id="doc-edit-category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {DOC_CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError errors={toFieldErrors(errors.category)} />
          </Field>
          <Field data-invalid={Boolean(errors.summary)}>
            <FieldLabel htmlFor="doc-edit-summary">Summary</FieldLabel>
            <Input
              id="doc-edit-summary"
              value={draft.summary}
              onChange={(e) => set("summary", e.target.value)}
              maxLength={500}
              placeholder="One line shown in lists"
              aria-invalid={Boolean(errors.summary)}
            />
            <FieldError errors={toFieldErrors(errors.summary)} />
          </Field>
        </div>

        <LinkFields
          idPrefix="doc-edit"
          options={options}
          value={draft}
          onChange={(links) => setDraft((d) => ({ ...d, ...links }))}
          errors={errors}
        />

        <Field data-invalid={Boolean(errors.content_markdown || contentWarning)}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <FieldLabel htmlFor="doc-edit-content">Content</FieldLabel>
            <SegmentedControl
              label="Editor view"
              value={mode}
              onValueChange={setMode}
              options={[
                { value: "write", label: "Write" },
                { value: "preview", label: "Preview" },
                { value: "split", label: "Side by side", className: "hidden lg:inline-flex" },
              ]}
            />
          </div>
          {contentWarning ? (
            <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {contentWarning}
            </p>
          ) : null}
          <div className={cn("grid gap-4", mode === "split" && "lg:grid-cols-2")}>
            <Textarea
              id="doc-edit-content"
              value={draft.content_markdown}
              onChange={(e) => set("content_markdown", e.target.value)}
              maxLength={MAX_CONTENT}
              spellCheck
              placeholder={
                "# Local setup\n\n1. Install pnpm\n2. `pnpm install`\n3. Copy `.env.example` to `.env.local` and fill it from the vault"
              }
              aria-invalid={Boolean(errors.content_markdown || contentWarning)}
              className={cn(
                "min-h-[55dvh] resize-y font-mono text-sm leading-relaxed",
                mode === "preview" && "hidden",
              )}
            />
            {mode !== "write" ? (
              <div
                className="min-h-[55dvh] min-w-0 rounded-md border p-4"
                aria-label="Preview"
                role="region"
              >
                {preview.trim() ? (
                  <Markdown>{preview}</Markdown>
                ) : (
                  <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
                )}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Markdown with tables and task lists. HTML isn&apos;t rendered.{" "}
              <a
                href="https://commonmark.org/help/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                Syntax
              </a>
            </span>
            {draft.content_markdown.length > MAX_CONTENT * 0.9 ? (
              <span>
                {draft.content_markdown.length.toLocaleString("en")} /{" "}
                {MAX_CONTENT.toLocaleString("en")}
              </span>
            ) : null}
          </div>
          <FieldError errors={toFieldErrors(errors.content_markdown)} />
        </Field>
      </FieldGroup>
    </form>
  )
}
