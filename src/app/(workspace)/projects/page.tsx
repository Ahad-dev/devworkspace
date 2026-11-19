import type { Metadata } from "next"
import { FolderKanban } from "lucide-react"

import { NotBuiltYet } from "@/components/shared/not-built-yet"
import { PageContainer, PageHeader } from "@/components/shared/page-header"

export const metadata: Metadata = { title: "Projects" }

export default function Page() {
  return (
    <PageContainer>
      <PageHeader
        title="Projects"
        description="Your software projects and their technical context."
      />
      <NotBuiltYet
        icon={FolderKanban}
        title="No projects yet"
        description="Register projects with their repositories, technology stack, environments, services and docs."
        phase="Phase 2 (P2.6–P2.10)"
      />
    </PageContainer>
  )
}
