import type { Metadata } from "next"
import { LayoutDashboard } from "lucide-react"

import { NotBuiltYet } from "@/components/shared/not-built-yet"
import { PageContainer, PageHeader } from "@/components/shared/page-header"

export const metadata: Metadata = { title: "Overview" }

export default function Page() {
  return (
    <PageContainer>
      <PageHeader title="Overview" description="What needs attention across all your projects." />
      <NotBuiltYet
        icon={LayoutDashboard}
        title="Your daily overview"
        description="Current focus, work queue, overdue and blocked work, upcoming deadlines and recent activity will show here."
        phase="Phase 7 (P7.1–P7.3)"
      />
    </PageContainer>
  )
}
