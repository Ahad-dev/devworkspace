"use client"

import { useActionState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { updatePassword } from "../actions"
import { PASSWORD_MIN, initialAuthFormState } from "../schemas"
import { FormMessage, toFieldErrors } from "./form-message"

export function UpdatePasswordForm() {
  const [state, formAction, pending] = useActionState(updatePassword, initialAuthFormState)

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">You&apos;ll stay signed in after saving it.</p>
      </div>

      {state.status === "error" && state.message ? (
        <FormMessage status="error">{state.message}</FormMessage>
      ) : null}

      <FieldGroup>
        <Field data-invalid={Boolean(state.fieldErrors?.password)}>
          <FieldLabel htmlFor="password">New password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            autoFocus
            required
            minLength={PASSWORD_MIN}
            aria-invalid={Boolean(state.fieldErrors?.password)}
          />
          <FieldDescription>At least {PASSWORD_MIN} characters.</FieldDescription>
          <FieldError errors={toFieldErrors(state.fieldErrors?.password)} />
        </Field>
        <Field data-invalid={Boolean(state.fieldErrors?.confirm)}>
          <FieldLabel htmlFor="confirm">Confirm new password</FieldLabel>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={Boolean(state.fieldErrors?.confirm)}
          />
          <FieldError errors={toFieldErrors(state.fieldErrors?.confirm)} />
        </Field>
      </FieldGroup>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {pending ? "Saving…" : "Save password"}
      </Button>
    </form>
  )
}
