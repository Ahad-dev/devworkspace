import type { Metadata } from "next"
import { Suspense } from "react"

import { PageContainer, PageHeader } from "@/components/shared/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { KnowledgeView } from "@/features/knowledge/components/knowledge-view"

export const metadata: Metadata = { title: "Knowledge Base" }

/** Documents and commands across projects (Spec FR-10, FR-11; Plan P6.4). */
export default function KnowledgePage({ searchParams }: PageProps<"/knowledge">) {
  return (
    <PageContainer>
      <PageHeader
        title="Knowledge Base"
        description="Setup guides, runbooks, decisions and notes in Markdown, plus the commands you keep looking up. References and placeholders only, never secret values."
      />
      <Suspense fallback={<Skeleton className="h-72 w-full" />}>
        <KnowledgeView searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  )
}
