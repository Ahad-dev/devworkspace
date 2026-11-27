import "server-only"

import { cache } from "react"
import { notFound } from "next/navigation"
import { z } from "zod"

import { requireUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

/**
 * Accounts reads for Server Components (Plan P11.4). Metadata only: these never select ciphertext,
 * IVs or key material. The browser fetches a sealed value itself at reveal or copy time.
 */

const isUuid = (v: string) => z.uuid().safeParse(v).success

/** Whether the signed-in user has set up a vault (no key material is read). */
export const hasVault = cache(async () => {
  await requireUser()
  const supabase = await createClient()
  const { data } = await supabase.from("vault_keys").select("id").maybeSingle()
  return Boolean(data)
})

const SERVICE_EMBED =
  "services:project_services!project_services_account_owner_fkey(id, name, project_id, project:projects!project_services_project_owner_fkey(name))"

export async function listAccounts() {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("accounts")
    .select(
      `id, platform, label, login_identifier, login_url, two_factor, updated_at, secrets:account_secrets!account_secrets_account_owner_fkey(count), ${SERVICE_EMBED}`,
    )
    .order("platform")
    .order("label", { nullsFirst: true })
  if (error) throw new Error("Couldn't load accounts")
  return (data ?? []).map((a) => {
    const services = (a.services ?? []) as {
      id: string
      name: string
      project_id: string
      project: { name: string } | null
    }[]
    return {
      id: a.id,
      platform: a.platform,
      label: a.label,
      login_identifier: a.login_identifier,
      login_url: a.login_url,
      two_factor: a.two_factor,
      updated_at: a.updated_at,
      secretCount: (a.secrets as unknown as { count: number }[])?.[0]?.count ?? 0,
      projects: [
        ...new Map(services.map((s) => [s.project_id, s.project?.name ?? "Project"])).values(),
      ],
    }
  })
}

export type AccountListRow = Awaited<ReturnType<typeof listAccounts>>[number]

export const getAccount = cache(async (accountId: string) => {
  await requireUser()
  if (!isUuid(accountId)) notFound()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("accounts")
    .select(
      `id, platform, label, login_identifier, login_url, two_factor, notes, created_at, updated_at, ${SERVICE_EMBED}`,
    )
    .eq("id", accountId)
    .maybeSingle()
  if (error) throw new Error("Couldn't load the account")
  if (!data) notFound()
  return {
    ...data,
    services: (data.services ?? []) as {
      id: string
      name: string
      project_id: string
      project: { name: string } | null
    }[],
  }
})

export type AccountDetail = Awaited<ReturnType<typeof getAccount>>

/** Labels and kinds only. */
export async function listSecretMeta(accountId: string) {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("account_secrets")
    .select("id, label, kind, value_updated_at")
    .eq("account_id", accountId)
    .order("label")
  if (error) throw new Error("Couldn't load the account's secrets")
  return data ?? []
}

export type SecretMeta = Awaited<ReturnType<typeof listSecretMeta>>[number]

/** Account choices for a service's "Account" picker. */
export async function listAccountOptions() {
  await requireUser()
  const supabase = await createClient()
  const { data } = await supabase
    .from("accounts")
    .select("id, platform, label")
    .order("platform")
    .order("label", { nullsFirst: true })
  return (data ?? []).map((a) => ({
    id: a.id,
    name: a.label ? `${a.platform} (${a.label})` : a.platform,
  }))
}

/** Project services not linked to an account yet: the Accounts page offers to link them. */
export async function listUnlinkedServices() {
  await requireUser()
  const supabase = await createClient()
  const { data } = await supabase
    .from("project_services")
    .select(
      "id, name, provider, project_id, project:projects!project_services_project_owner_fkey(name)",
    )
    .is("account_id", null)
    .order("name")
    .limit(200)
  return data ?? []
}

/** Vault items for a variable's "Where the value is stored" picker (Plan P12.3). Labels only. */
export async function listVaultItemOptions() {
  await requireUser()
  const supabase = await createClient()
  const { data } = await supabase
    .from("account_secrets")
    .select(
      "id, label, kind, account_id, account:accounts!account_secrets_account_owner_fkey(platform, label)",
    )
    .limit(1000)
  return (data ?? [])
    .map((s) => ({
      id: s.id,
      accountId: s.account_id,
      label: s.label,
      kind: s.kind,
      account: s.account
        ? s.account.label
          ? `${s.account.platform} (${s.account.label})`
          : s.account.platform
        : "Account",
    }))
    .sort((a, b) => a.account.localeCompare(b.account) || a.label.localeCompare(b.label))
}

export type VaultItemOption = Awaited<ReturnType<typeof listVaultItemOptions>>[number]
