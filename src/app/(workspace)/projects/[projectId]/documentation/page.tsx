import type { Metadata } from "next"
import { BookOpen } from "lucide-react"

import { NotBuiltYet } from "@/components/shared/not-built-yet"

export const metadata: Metadata = { title: "Documentation" }

export default function Page() {
  return (
    <NotBuiltYet
      icon={BookOpen}
      title="No documents yet"
      description="Setup guides, runbooks and saved commands for this project."
      phase="Phase 6"
    />
  )
}
