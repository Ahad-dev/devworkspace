"use client"

import { useActionState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { requestPasswordReset } from "../actions"
import { initialAuthFormState } from "../schemas"
import { FormMessage, toFieldErrors } from "./form-message"

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialAuthFormState)

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">Reset your password</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a link to choose a new password.
        </p>
      </div>

      {state.status === "success" && state.message ? (
        <FormMessage status="success">{state.message}</FormMessage>
      ) : null}

      {state.status !== "success" ? (
        <>
          <FieldGroup>
            <Field data-invalid={Boolean(state.fieldErrors?.email)}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                autoFocus
                required
                defaultValue={state.email}
                aria-invalid={Boolean(state.fieldErrors?.email)}
              />
              <FieldError errors={toFieldErrors(state.fieldErrors?.email)} />
            </Field>
          </FieldGroup>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </>
      ) : null}

      <Link
        href="/login"
        className="text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Back to sign in
      </Link>
    </form>
  )
}
