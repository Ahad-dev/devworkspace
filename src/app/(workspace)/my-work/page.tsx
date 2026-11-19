import type { Metadata } from "next"
import { ListTodo } from "lucide-react"

import { NotBuiltYet } from "@/components/shared/not-built-yet"
import { PageContainer, PageHeader } from "@/components/shared/page-header"

export const metadata: Metadata = { title: "My Work" }

export default function Page() {
  return (
    <PageContainer>
      <PageHeader title="My Work" description="Every task across your projects in one queue." />
      <NotBuiltYet
        icon={ListTodo}
        title="No task manager yet"
        description="List and board views with filters for status, priority, due date, repository and labels."
        phase="Phase 3 (P3.6–P3.9)"
      />
    </PageContainer>
  )
}
