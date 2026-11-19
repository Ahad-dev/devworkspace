"use client"

import { useActionState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { signIn } from "../actions"
import { initialAuthFormState } from "../schemas"
import { FormMessage, toFieldErrors } from "./form-message"

const LINK_ERROR = "That link is invalid or has expired. Request a new one."

export function LoginForm() {
  const searchParams = useSearchParams()
  const [state, formAction, pending] = useActionState(signIn, initialAuthFormState)
  const linkError = searchParams.get("error") === "link" && state.status === "idle"

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Use the account you set up for this workspace.
        </p>
      </div>

      {linkError ? <FormMessage status="error">{LINK_ERROR}</FormMessage> : null}
      {state.status === "error" && state.message ? (
        <FormMessage status="error">{state.message}</FormMessage>
      ) : null}

      <input type="hidden" name="next" value={searchParams.get("next") ?? ""} />

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
        <Field data-invalid={Boolean(state.fieldErrors?.password)}>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Link
              href="/reset-password"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={Boolean(state.fieldErrors?.password)}
          />
          <FieldError errors={toFieldErrors(state.fieldErrors?.password)} />
        </Field>
      </FieldGroup>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  )
}
