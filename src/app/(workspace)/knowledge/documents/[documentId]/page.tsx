import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { Archive, ChevronLeft, FileText } from "lucide-react"

import { EnvironmentBadge } from "@/components/shared/domain-badges"
import { Markdown } from "@/components/shared/markdown"
import { PageContainer } from "@/components/shared/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { AttachmentsPanel } from "@/features/knowledge/components/attachments-panel"
import { DocumentActions } from "@/features/knowledge/components/document-actions"
import { DocCategoryBadge } from "@/features/knowledge/components/knowledge-badges"
import { LinkedTasksPanel } from "@/features/knowledge/components/linked-tasks-panel"
import {
  getDocument,
  listDocumentAttachments,
  listDocumentTasks,
  listLinkableTasks,
} from "@/features/knowledge/queries"
import { getMyProfile } from "@/features/profile/queries"
import type { EnvironmentType } from "@/lib/constants/domain"
import { formatDateTime } from "@/lib/format"

export const metadata: Metadata = { title: "Document" }

/** One document, rendered (Spec FR-10, §6.10; Plan P6.5). */
export default function DocumentPage({ params }: PageProps<"/knowledge/documents/[documentId]">) {
  return (
    <PageContainer className="gap-5">
      <Suspense fallback={<Skeleton className="h-[32rem] w-full" />}>
        {params.then(({ documentId }) => (
          <DocumentView documentId={documentId} />
        ))}
      </Suspense>
    </PageContainer>
  )
}

async function DocumentView({ documentId }: { documentId: string }) {
  const doc = await getDocument(documentId)
  const [attachments, tasks, taskOptions, profile] = await Promise.all([
    listDocumentAttachments(doc.id),
    listDocumentTasks(doc.id),
    listLinkableTasks(doc.project_id),
    getMyProfile(),
  ])
  const archived = Boolean(doc.archived_at)
  const tz = profile.timezone

  return (
    <>
      <Link
        href={doc.project ? `/projects/${doc.project.id}/documentation` : "/knowledge"}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {doc.project ? `${doc.project.name} documentation` : "Knowledge base"}
      </Link>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-xl font-semibold tracking-tight break-words">{doc.title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <DocCategoryBadge category={doc.category} />
            {doc.project ? (
              <Link
                href={`/projects/${doc.project.id}`}
                className="underline-offset-4 hover:text-foreground hover:underline"
              >
                {doc.project.name}
              </Link>
            ) : (
              <span>Global</span>
            )}
            {doc.environment ? (
              <Link
                href={`/environments/${doc.environment.id}`}
                className="inline-flex items-center gap-1 underline-offset-4 hover:text-foreground hover:underline"
              >
                <EnvironmentBadge
                  type={doc.environment.environment_type as EnvironmentType}
                  variant="short"
                />
                {doc.environment.name}
              </Link>
            ) : null}
            {doc.repository ? (
              <span className="font-mono text-xs">{doc.repository.name}</span>
            ) : null}
            <span className="whitespace-nowrap">Updated {formatDateTime(doc.updated_at, tz)}</span>
          </div>
        </div>
        <DocumentActions
          documentId={doc.id}
          title={doc.title}
          archived={archived}
          attachmentCount={attachments.length}
        />
      </header>

      {archived ? (
        <p
          role="note"
          className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
        >
          <Archive className="size-4 shrink-0" aria-hidden />
          Archived {formatDateTime(doc.archived_at, tz)}. Restore it to edit or add files.
        </p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <article className="flex min-w-0 flex-col gap-4">
          {doc.summary ? <p className="text-sm text-muted-foreground">{doc.summary}</p> : null}
          {doc.content_markdown.trim() ? (
            <Markdown>{doc.content_markdown}</Markdown>
          ) : (
            <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              <FileText className="size-5" aria-hidden />
              This document is empty.
              {!archived ? (
                <Link
                  href={`/knowledge/documents/${doc.id}/edit`}
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  Start writing
                </Link>
              ) : null}
            </div>
          )}
        </article>

        <aside className="flex flex-col gap-6 lg:border-l lg:pl-6">
          <AttachmentsPanel documentId={doc.id} attachments={attachments} readOnly={archived} />
          <LinkedTasksPanel
            documentId={doc.id}
            tasks={tasks}
            options={taskOptions}
            showProject={!doc.project_id}
            readOnly={archived}
          />
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">Created</dt>
              <dd>{formatDateTime(doc.created_at, tz)}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">Updated</dt>
              <dd>{formatDateTime(doc.updated_at, tz)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </>
  )
}
