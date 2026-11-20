import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"

import { PageContainer } from "@/components/shared/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { AttachmentsPanel } from "@/features/knowledge/components/attachments-panel"
import { DocumentEditor } from "@/features/knowledge/components/document-editor"
import { LinkedTasksPanel } from "@/features/knowledge/components/linked-tasks-panel"
import {
  getDocument,
  listDocumentAttachments,
  listDocumentTasks,
  listLinkableTasks,
  listLinkOptions,
} from "@/features/knowledge/queries"
import { getMyProfile } from "@/features/profile/queries"

export const metadata: Metadata = { title: "Edit document" }

/** Documentation editor (Spec §6.10; Plan P6.5). */
export default function EditDocumentPage({
  params,
}: PageProps<"/knowledge/documents/[documentId]/edit">) {
  return (
    <PageContainer className="gap-4">
      <Suspense fallback={<Skeleton className="h-[36rem] w-full" />}>
        {params.then(({ documentId }) => (
          <EditDocument documentId={documentId} />
        ))}
      </Suspense>
    </PageContainer>
  )
}

async function EditDocument({ documentId }: { documentId: string }) {
  const doc = await getDocument(documentId)
  if (doc.archived_at) redirect(`/knowledge/documents/${doc.id}`)
  const [options, attachments, tasks, taskOptions, profile] = await Promise.all([
    listLinkOptions(),
    listDocumentAttachments(doc.id),
    listDocumentTasks(doc.id),
    listLinkableTasks(doc.project_id),
    getMyProfile(),
  ])

  return (
    <>
      <Link
        href={`/knowledge/documents/${doc.id}`}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Back to document
      </Link>
      <h1 className="sr-only">Edit {doc.title}</h1>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        {/* The editor owns its draft: a save refreshes the page data without resetting it. */}
        <DocumentEditor doc={doc} options={options} timeZone={profile.timezone} />
        <aside className="flex flex-col gap-6 lg:border-l lg:pl-6">
          <AttachmentsPanel documentId={doc.id} attachments={attachments} />
          <LinkedTasksPanel
            documentId={doc.id}
            tasks={tasks}
            options={taskOptions}
            showProject={!doc.project_id}
          />
        </aside>
      </div>
    </>
  )
}
