import type { Metadata } from "next"
import { Suspense } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { LoginForm } from "@/features/auth/components/login-form"

export const metadata: Metadata = { title: "Sign in" }

export default function LoginPage() {
  // LoginForm reads ?next and ?error, which is request data: it streams behind Suspense.
  return (
    <Suspense fallback={<Skeleton className="h-72 w-full" />}>
      <LoginForm />
    </Suspense>
  )
}
