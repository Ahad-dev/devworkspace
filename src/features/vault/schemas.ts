import { z } from "zod"

import { optionalText, optionalUrl } from "@/features/projects/schemas"
import { secretMessage } from "@/lib/security/secret-guard"

/**
 * Accounts and vault input (Plan P11.1–P11.5). Mirrors the database checks. Vault writes accept
 * ciphertext only: the schemas are strict, so an extra field (say, a plaintext value) is refused.
 */

export const ACCOUNT_SECRET_KINDS = [
  "password",
  "api_key",
  "token",
  "recovery_codes",
  "note",
] as const
export type AccountSecretKind = (typeof ACCOUNT_SECRET_KINDS)[number]
export const ACCOUNT_SECRET_KIND_LABELS: Record<AccountSecretKind, string> = {
  password: "Password",
  api_key: "API key",
  token: "Token",
  recovery_codes: "Recovery codes",
  note: "Secure note",
}

export const TWO_FACTOR_METHODS = [
  "unknown",
  "none",
  "authenticator_app",
  "sms",
  "email",
  "security_key",
] as const
export type TwoFactorMethod = (typeof TWO_FACTOR_METHODS)[number]
export const TWO_FACTOR_LABELS: Record<TwoFactorMethod, string> = {
  unknown: "Not recorded",
  none: "None",
  authenticator_app: "Authenticator app",
  sms: "SMS",
  email: "Email code",
  security_key: "Security key",
}

const base64 = (length?: { exact?: number; min?: number; max?: number }) =>
  z
    .string()
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, "Not base64")
    .refine((v) => v.length % 4 === 0, "Not base64")
    .refine((v) => (length?.exact ? v.length === length.exact : true), "Wrong length")
    .refine((v) => (length?.min ? v.length >= length.min : true), "Too short")
    .refine((v) => (length?.max ? v.length <= length.max : true), "Too long")

export const masterFieldsSchema = z.strictObject({
  kdf_iterations: z.number().int().min(600_000).max(5_000_000),
  kdf_salt: base64({ exact: 24 }),
  master_wrapped_key: base64({ exact: 64 }),
  master_wrap_iv: base64({ exact: 16 }),
})

export const recoveryFieldsSchema = z.strictObject({
  recovery_salt: base64({ exact: 24 }),
  recovery_wrapped_key: base64({ exact: 64 }),
  recovery_wrap_iv: base64({ exact: 16 }),
})

export const vaultRecordSchema = z.strictObject({
  ...masterFieldsSchema.shape,
  ...recoveryFieldsSchema.shape,
})

/** A required, trimmed text field that refuses anything that looks like a secret. */
function requiredText(max: number, label: string) {
  return z
    .string()
    .trim()
    .min(1, `Enter ${label}`)
    .max(max, `Use at most ${max} characters`)
    .superRefine((v, ctx) => {
      const msg = secretMessage(v)
      if (msg) ctx.addIssue({ code: "custom", message: msg })
    })
}

export const accountSchema = z.object({
  platform: requiredText(80, "the platform, e.g. Neon"),
  label: optionalText(80),
  // The login email or username: no spaces, so a pasted sentence or "user password" is refused.
  login_identifier: z
    .string()
    .trim()
    .max(254, "Use at most 254 characters")
    .refine((v) => !/\s/.test(v), "A login has no spaces: enter just the email or username")
    .transform((v) => (v === "" ? null : v))
    .superRefine((v, ctx) => {
      const msg = secretMessage(v)
      if (msg) ctx.addIssue({ code: "custom", message: msg })
    }),
  login_url: optionalUrl,
  two_factor: z.enum(TWO_FACTOR_METHODS),
  notes: optionalText(10_000),
})

export const secretWriteSchema = z.strictObject({
  id: z.uuid(),
  accountId: z.uuid(),
  label: requiredText(80, "a label, e.g. Password or API key (production)"),
  kind: z.enum(ACCOUNT_SECRET_KINDS),
  ciphertext: base64({ min: 64, max: 22_000 }),
  iv: base64({ exact: 16 }),
})
export type SecretWrite = z.infer<typeof secretWriteSchema>
