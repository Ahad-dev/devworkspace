import type { Metadata } from "next"
import { Suspense } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { KnowledgeView } from "@/features/knowledge/components/knowledge-view"

export const metadata: Metadata = { title: "Documentation" }

/** A project's documents and commands (Spec FR-03 Documentation tab; Plan P6.4). */
export default function ProjectDocumentationPage({
  params,
  searchParams,
}: PageProps<"/projects/[projectId]/documentation">) {
  return (
    <Suspense fallback={<Skeleton className="h-72 w-full" />}>
      {params.then(({ projectId }) => (
        <KnowledgeView searchParams={searchParams} projectId={projectId} />
      ))}
    </Suspense>
  )
}
