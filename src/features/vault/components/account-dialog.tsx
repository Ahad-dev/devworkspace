"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus } from "lucide-react"
import { toast } from "sonner"

import { MoreDetails } from "@/components/shared/more-details"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { FormMessage, toFieldErrors } from "@/features/auth/components/form-message"
import { initialFormState, type FormState } from "@/features/projects/schemas"
import { offlineFormState, whenOnline } from "@/lib/offline/guard"
import { saveAccount } from "../actions"
import { TWO_FACTOR_LABELS, TWO_FACTOR_METHODS, type TwoFactorMethod } from "../schemas"

export type AccountFormValues = {
  id: string
  platform: string
  label: string | null
  login_identifier: string | null
  login_url: string | null
  two_factor: TwoFactorMethod
  notes: string | null
}

/** Platforms worth suggesting while typing; anything else works too. */
const PLATFORMS = [
  "Neon",
  "Supabase",
  "Vercel",
  "Render",
  "Netlify",
  "Resend",
  "Postmark",
  "SendGrid",
  "Stripe",
  "Cloudflare",
  "AWS",
  "Google Cloud",
  "GitHub",
  "GitLab",
  "Bitbucket",
  "Upstash",
  "Hetzner",
  "DigitalOcean",
  "Sentry",
  "OpenAI",
  "Anthropic",
]

/**
 * Add or edit an account's details (Plan P11.4): which platform, which login. Not its secrets:
 * those are added on the account page, encrypted. The login email or username is not a secret.
 */
export function AccountDialog({
  account,
  trigger,
}: {
  account?: AccountFormValues
  /** One element (a button); it opens the dialog. */
  trigger?: React.ReactElement
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [state, dispatch, pending] = React.useActionState(
    async (prev: FormState, formData: FormData) => {
      const r = await whenOnline(
        () => saveAccount(account?.id ?? null, prev, formData),
        offlineFormState,
      )
      if (r.status === "success") {
        toast.success(r.message ?? "Saved")
        setOpen(false)
        const id = (r.data as { id?: string } | undefined)?.id
        if (!account && id) router.push(`/accounts/${id}`)
      }
      return r
    },
    initialFormState,
  )
  const err = (k: string) => toFieldErrors(state.fieldErrors?.[k])
  const hasMore =
    Boolean(
      account?.login_url || account?.notes || (account && account.two_factor !== "unknown"),
    ) || ["login_url", "notes"].some((k) => Boolean(state.fieldErrors?.[k]))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus />
            New account
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form
          className="flex flex-col gap-6"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            const data = new FormData(e.currentTarget)
            React.startTransition(() => dispatch(data))
          }}
        >
          <DialogHeader>
            <DialogTitle>{account ? `Edit ${account.platform}` : "New account"}</DialogTitle>
            <DialogDescription>
              A login you use on a platform, such as your Neon or Resend account. Add its passwords
              and API keys on the next page.
            </DialogDescription>
          </DialogHeader>
          {state.status === "error" && state.message ? (
            <FormMessage status="error">{state.message}</FormMessage>
          ) : null}
          <FieldGroup>
            <div className="grid gap-6 sm:grid-cols-2">
              <Field data-invalid={Boolean(state.fieldErrors?.platform)}>
                <FieldLabel htmlFor="acct-platform">Platform</FieldLabel>
                <Input
                  id="acct-platform"
                  name="platform"
                  list="acct-platforms"
                  defaultValue={account?.platform ?? ""}
                  maxLength={80}
                  placeholder="Neon"
                  autoFocus
                  autoComplete="off"
                />
                <datalist id="acct-platforms">
                  {PLATFORMS.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
                <FieldError errors={err("platform")} />
              </Field>
              <Field data-invalid={Boolean(state.fieldErrors?.label)}>
                <FieldLabel htmlFor="acct-label">Which one</FieldLabel>
                <Input
                  id="acct-label"
                  name="label"
                  defaultValue={account?.label ?? ""}
                  maxLength={80}
                  placeholder="Work, Personal, Client X…"
                  autoComplete="off"
                />
                <FieldError errors={err("label")} />
              </Field>
            </div>
            <Field data-invalid={Boolean(state.fieldErrors?.login_identifier)}>
              <FieldLabel htmlFor="acct-login">Login email or username</FieldLabel>
              <Input
                id="acct-login"
                name="login_identifier"
                defaultValue={account?.login_identifier ?? ""}
                maxLength={254}
                placeholder="you@example.com"
                autoComplete="off"
                spellCheck={false}
              />
              <FieldDescription>
                Not the password: that goes in the vault on the next page.
              </FieldDescription>
              <FieldError errors={err("login_identifier")} />
            </Field>
            <MoreDetails open={hasMore} hint="sign-in link, two-factor, notes">
              <Field data-invalid={Boolean(state.fieldErrors?.login_url)}>
                <FieldLabel htmlFor="acct-url">Sign-in or dashboard link</FieldLabel>
                <Input
                  id="acct-url"
                  name="login_url"
                  type="url"
                  defaultValue={account?.login_url ?? ""}
                  placeholder="https://console.neon.tech"
                />
                <FieldError errors={err("login_url")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="acct-2fa">Two-factor</FieldLabel>
                <Select name="two_factor" defaultValue={account?.two_factor ?? "unknown"}>
                  <SelectTrigger id="acct-2fa" className="w-full sm:w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TWO_FACTOR_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {TWO_FACTOR_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field data-invalid={Boolean(state.fieldErrors?.notes)}>
                <FieldLabel htmlFor="acct-notes">Notes</FieldLabel>
                <Textarea
                  id="acct-notes"
                  name="notes"
                  rows={3}
                  defaultValue={account?.notes ?? ""}
                  placeholder="Billing owner, which team, anything worth remembering (no secrets)"
                />
                <FieldError errors={err("notes")} />
              </Field>
            </MoreDetails>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {account ? "Save account" : "Add account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
