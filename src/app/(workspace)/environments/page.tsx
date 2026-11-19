import type { Metadata } from "next"
import { Server } from "lucide-react"

import { NotBuiltYet } from "@/components/shared/not-built-yet"
import { PageContainer, PageHeader } from "@/components/shared/page-header"

export const metadata: Metadata = { title: "Environments" }

export default function Page() {
  return (
    <PageContainer>
      <PageHeader
        title="Environments"
        description="Local, development, staging and production environments across projects."
      />
      <NotBuiltYet
        icon={Server}
        title="No environments yet"
        description="Document how each project runs per environment, which variables it needs, and compare environments side by side."
        phase="Phase 5 (P5.4–P5.7)"
      />
    </PageContainer>
  )
}
