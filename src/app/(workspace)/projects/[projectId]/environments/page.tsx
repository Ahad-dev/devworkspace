import type { Metadata } from "next"
import { Server } from "lucide-react"

import { NotBuiltYet } from "@/components/shared/not-built-yet"

export const metadata: Metadata = { title: "Environments" }

export default function Page() {
  return (
    <NotBuiltYet
      icon={Server}
      title="No environments yet"
      description="Local, development, staging and production details for this project."
      phase="Phase 5"
    />
  )
}
