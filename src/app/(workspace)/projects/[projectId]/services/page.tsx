import type { Metadata } from "next"
import { Boxes } from "lucide-react"

import { NotBuiltYet } from "@/components/shared/not-built-yet"

export const metadata: Metadata = { title: "Services" }

export default function Page() {
  return (
    <NotBuiltYet
      icon={Boxes}
      title="No services yet"
      description="Databases, hosting, APIs and other dependencies of this project."
      phase="Phase 5"
    />
  )
}
