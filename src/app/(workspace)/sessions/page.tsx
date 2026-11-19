import type { Metadata } from "next"
import { Timer } from "lucide-react"

import { NotBuiltYet } from "@/components/shared/not-built-yet"
import { PageContainer, PageHeader } from "@/components/shared/page-header"

export const metadata: Metadata = { title: "Work Sessions" }

export default function Page() {
  return (
    <PageContainer>
      <PageHeader
        title="Work Sessions"
        description="Focused work periods and the handoffs you saved."
      />
      <NotBuiltYet
        icon={Timer}
        title="No work sessions yet"
        description="Start, pause and resume sessions on a task and save handoffs so you can pick up where you left off."
        phase="Phase 4 (P4.4–P4.7)"
      />
    </PageContainer>
  )
}
