"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import type { FormState } from "@/features/projects/schemas"
import { requireUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import {
  accountSchema,
  masterFieldsSchema,
  recoveryFieldsSchema,
  secretWriteSchema,
  vaultRecordSchema,
  type SecretWrite,
} from "./schemas"

/**
 * Accounts and vault actions (Plan P11.1–P11.5; docs/SECURITY.md §8). Vault actions take typed JSON
 * whose only value fields are ciphertext, IVs, salts and wrapped keys: a plaintext secret has no
 * field to travel in. Every write runs as the signed-in user, so RLS and column grants apply.
 */

export type ActionResult = { ok: true } | { ok: false; error: string }

const uuid = z.uuid()
const text = (fd: FormData, key: string) => String(fd.get(key) ?? "")

function revalidate(accountId?: string) {
  revalidatePath("/accounts")
  revalidatePath("/settings")
  if (accountId) revalidatePath(`/accounts/${accountId}`)
  // Variables show and pick vault items (Plan P12.3).
  revalidatePath("/environments", "layout")
}

function failed(error: { code?: string; hint?: string } | null, fallback: string): ActionResult {
  switch (error?.code) {
    case "23505":
      return { ok: false, error: "That label is already used on this account. Pick another." }
    case "23514":
      return {
        ok: false,
        error:
          error.hint === "iv_reuse"
            ? "The value couldn't be saved safely. Try again."
            : "Something here isn't allowed. Check the label for anything that looks like a secret.",
      }
    case "23503":
      return { ok: false, error: "Set up the vault first, then add secrets." }
    default:
      return { ok: false, error: fallback }
  }
}

/* Vault ----------------------------------------------------------------------------------------- */

export async function createVaultRecord(input: unknown): Promise<ActionResult> {
  await requireUser()
  const parsed = vaultRecordSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "The vault data was malformed. Try again." }
  const supabase = await createClient()
  const { error } = await supabase.from("vault_keys").insert(parsed.data)
  if (error?.code === "23505") return { ok: false, error: "This account already has a vault." }
  if (error) return failed(error, "Couldn't create the vault. Try again.")
  revalidate()
  return { ok: true }
}

export async function updateVaultMaster(input: unknown): Promise<ActionResult> {
  const user = await requireUser()
  const parsed = masterFieldsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "The vault data was malformed. Try again." }
  const supabase = await createClient()
  const { error, count } = await supabase
    .from("vault_keys")
    .update(parsed.data, { count: "exact" })
    .eq("owner_id", user.id)
  if (error || !count) return failed(error, "Couldn't change the master password. Try again.")
  revalidate()
  return { ok: true }
}

export async function updateVaultRecovery(input: unknown): Promise<ActionResult> {
  const user = await requireUser()
  const parsed = recoveryFieldsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "The vault data was malformed. Try again." }
  const supabase = await createClient()
  const { error, count } = await supabase
    .from("vault_keys")
    .update(parsed.data, { count: "exact" })
    .eq("owner_id", user.id)
  if (error || !count) return failed(error, "Couldn't save the new recovery key. Try again.")
  revalidate()
  return { ok: true }
}

/** Deletes the vault and every stored secret (accounts stay). Needs the typed confirmation. */
export async function resetVault(input: { confirm: string }): Promise<ActionResult> {
  const user = await requireUser()
  if (input?.confirm !== "RESET") return { ok: false, error: "Type RESET to confirm." }
  const supabase = await createClient()
  const { error } = await supabase.from("vault_keys").delete().eq("owner_id", user.id)
  if (error) return failed(error, "Couldn't reset the vault. Try again.")
  revalidate()
  return { ok: true }
}

/* Accounts --------------------------------------------------------------------------------------- */

export async function saveAccount(
  accountId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser()
  if (accountId !== null && !uuid.safeParse(accountId).success) {
    return { status: "error", message: "Unknown account." }
  }
  const parsed = accountSchema.safeParse({
    platform: text(formData, "platform"),
    label: text(formData, "label"),
    login_identifier: text(formData, "login_identifier"),
    login_url: text(formData, "login_url"),
    two_factor: text(formData, "two_factor") || "unknown",
    notes: text(formData, "notes"),
  })
  if (!parsed.success) {
    return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }
  const supabase = await createClient()
  const write = accountId
    ? supabase.from("accounts").update(parsed.data).eq("id", accountId).select("id").single()
    : supabase.from("accounts").insert(parsed.data).select("id").single()
  const { data, error } = await write
  if (error?.code === "23505") {
    return {
      status: "error",
      fieldErrors: {
        label: ["You already have this platform with this label. Use another label."],
      },
    }
  }
  if (error || !data) {
    return {
      status: "error",
      message:
        error?.code === "23514"
          ? "Something here isn't allowed: no credentials in URLs, and nothing that looks like a key or password."
          : "Couldn't save the account. Try again.",
    }
  }
  revalidate(data.id)
  return {
    status: "success",
    message: accountId ? "Account saved." : "Account added.",
    data: { id: data.id },
  }
}

export async function deleteAccount(input: { accountId: string }): Promise<FormState> {
  await requireUser()
  if (!uuid.safeParse(input?.accountId).success)
    return { status: "error", message: "Unknown account." }
  const supabase = await createClient()
  const { error } = await supabase.from("accounts").delete().eq("id", input.accountId)
  if (error) return { status: "error", message: "Couldn't delete the account. Try again." }
  revalidate()
  redirect("/accounts")
}

/* Secrets (ciphertext only) ---------------------------------------------------------------------- */

export async function addSecret(input: SecretWrite): Promise<ActionResult> {
  await requireUser()
  const parsed = secretWriteSchema.safeParse(input)
  if (!parsed.success) {
    const label = z.flattenError(parsed.error).fieldErrors.label?.[0]
    return { ok: false, error: label ?? "The secret couldn't be saved. Try again." }
  }
  const { id, accountId, label, kind, ciphertext, iv } = parsed.data
  const supabase = await createClient()
  const { error } = await supabase
    .from("account_secrets")
    .insert({ id, account_id: accountId, label, kind, ciphertext, iv })
  if (error) return failed(error, "Couldn't save the secret. Try again.")
  revalidate(accountId)
  return { ok: true }
}

export async function updateSecret(input: SecretWrite): Promise<ActionResult> {
  await requireUser()
  const parsed = secretWriteSchema.safeParse(input)
  if (!parsed.success) {
    const label = z.flattenError(parsed.error).fieldErrors.label?.[0]
    return { ok: false, error: label ?? "The secret couldn't be saved. Try again." }
  }
  const { id, accountId, label, kind, ciphertext, iv } = parsed.data
  const supabase = await createClient()
  const { error, count } = await supabase
    .from("account_secrets")
    .update({ label, kind, ciphertext, iv }, { count: "exact" })
    .eq("id", id)
    .eq("account_id", accountId)
  if (error || !count) return failed(error, "Couldn't save the secret. Try again.")
  revalidate(accountId)
  return { ok: true }
}

export async function deleteSecret(input: {
  secretId: string
  accountId: string
}): Promise<ActionResult> {
  await requireUser()
  if (!uuid.safeParse(input?.secretId).success || !uuid.safeParse(input?.accountId).success) {
    return { ok: false, error: "Unknown secret." }
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from("account_secrets")
    .delete()
    .eq("id", input.secretId)
    .eq("account_id", input.accountId)
  if (error) return failed(error, "Couldn't delete the secret. Try again.")
  revalidate(input.accountId)
  return { ok: true }
}
