"use client"

import * as React from "react"
import { useActionState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { FormMessage, toFieldErrors } from "@/features/auth/components/form-message"
import { completeOnboarding, updateProfile } from "../actions"
import { initialProfileFormState } from "../schemas"
import { TimezoneCombobox } from "./timezone-combobox"

const noopSubscribe = () => () => {}

export function ProfileForm({
  mode,
  email,
  displayName,
  timezone,
}: {
  mode: "onboarding" | "settings"
  email: string | null
  displayName: string | null
  timezone: string
}) {
  const [state, formAction, pending] = useActionState(
    mode === "onboarding" ? completeOnboarding : updateProfile,
    initialProfileFormState,
  )

  // During onboarding the stored timezone is still the 'UTC' default, so suggest the
  // browser's zone. Read hydration-safely: null on the server, the real zone in the browser.
  const detected = React.useSyncExternalStore(
    noopSubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null,
  )
  const [picked, setPicked] = React.useState<string | null>(null)
  const tz = picked ?? (mode === "onboarding" && detected ? detected : timezone)

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {state.status === "error" && state.message ? (
        <FormMessage status="error">{state.message}</FormMessage>
      ) : null}
      {mode === "settings" && state.status === "success" && state.message ? (
        <FormMessage status="success">{state.message}</FormMessage>
      ) : null}

      <FieldGroup>
        {mode === "settings" ? (
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" value={email ?? ""} disabled readOnly />
            <FieldDescription>Your sign-in email. Change it in Supabase Auth.</FieldDescription>
          </Field>
        ) : null}

        <Field data-invalid={Boolean(state.fieldErrors?.display_name)}>
          <FieldLabel htmlFor="display_name">Display name</FieldLabel>
          <Input
            id="display_name"
            name="display_name"
            autoComplete="name"
            autoFocus={mode === "onboarding"}
            defaultValue={displayName ?? ""}
            maxLength={100}
            aria-invalid={Boolean(state.fieldErrors?.display_name)}
          />
          <FieldError errors={toFieldErrors(state.fieldErrors?.display_name)} />
        </Field>

        <Field data-invalid={Boolean(state.fieldErrors?.timezone)}>
          <FieldLabel htmlFor="timezone">Timezone</FieldLabel>
          <TimezoneCombobox
            id="timezone"
            name="timezone"
            value={tz}
            onChange={setPicked}
            invalid={Boolean(state.fieldErrors?.timezone)}
          />
          <FieldDescription>Due dates and times are shown in this timezone.</FieldDescription>
          <FieldError errors={toFieldErrors(state.fieldErrors?.timezone)} />
        </Field>
      </FieldGroup>

      <Button
        type="submit"
        disabled={pending}
        className={mode === "onboarding" ? "w-full" : "self-start"}
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {mode === "onboarding"
          ? pending
            ? "Saving…"
            : "Continue to workspace"
          : pending
            ? "Saving…"
            : "Save profile"}
      </Button>
    </form>
  )
}
