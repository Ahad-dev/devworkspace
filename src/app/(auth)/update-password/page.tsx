import type { Metadata } from "next"

import { UpdatePasswordForm } from "@/features/auth/components/update-password-form"

export const metadata: Metadata = { title: "Choose a new password" }

/** Requires a session (the proxy redirects anonymous visitors). Reached from the reset email. */
export default function UpdatePasswordPage() {
  return <UpdatePasswordForm />
}
