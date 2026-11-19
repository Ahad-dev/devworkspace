import type { Metadata } from "next"
import { BookOpen } from "lucide-react"

import { NotBuiltYet } from "@/components/shared/not-built-yet"
import { PageContainer, PageHeader } from "@/components/shared/page-header"

export const metadata: Metadata = { title: "Knowledge Base" }

export default function Page() {
  return (
    <PageContainer>
      <PageHeader title="Knowledge Base" description="Technical documents and saved commands." />
      <NotBuiltYet
        icon={BookOpen}
        title="No documents or commands yet"
        description="Markdown setup guides, runbooks and troubleshooting notes, plus a library of copyable commands."
        phase="Phase 6 (P6.4–P6.6)"
      />
    </PageContainer>
  )
}
