import type { Metadata } from "next"
import { Boxes } from "lucide-react"

import { NotBuiltYet } from "@/components/shared/not-built-yet"
import { PageContainer, PageHeader } from "@/components/shared/page-header"

export const metadata: Metadata = { title: "Services" }

export default function Page() {
  return (
    <PageContainer>
      <PageHeader
        title="Services"
        description="Databases, hosting, APIs and other services your projects depend on."
      />
      <NotBuiltYet
        icon={Boxes}
        title="No services yet"
        description="Register a service once per project and record its instance in each environment."
        phase="Phase 5 (P5.8)"
      />
    </PageContainer>
  )
}
