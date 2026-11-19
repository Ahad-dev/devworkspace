import type { Metadata } from "next"
import { ListTodo } from "lucide-react"

import { NotBuiltYet } from "@/components/shared/not-built-yet"

export const metadata: Metadata = { title: "Tasks" }

export default function Page() {
  return (
    <NotBuiltYet
      icon={ListTodo}
      title="No tasks yet"
      description="This project's task list and board arrive with the task manager."
      phase="Phase 3"
    />
  )
}
