"use client"

import { createClient } from "@/lib/supabase/client"
import {
  decryptItem,
  encryptItem,
  unlockWithPassword,
  unlockWithRecoveryKey,
  type VaultKeyRecord,
} from "./crypto"
import { requireVaultKey, unlockVault } from "./store"

/**
 * Browser-side vault reads (Plan P11.5): key material and ciphertext come straight from the database
 * through RLS when they are needed, so they never pass through server rendering, HTML or the router
 * cache. Decrypted values stay in the browser.
 */

const RECORD_COLUMNS =
  "owner_id, kdf_iterations, kdf_salt, master_wrapped_key, master_wrap_iv, recovery_salt, recovery_wrapped_key, recovery_wrap_iv"

export async function fetchVaultRecord(): Promise<(VaultKeyRecord & { owner_id: string }) | null> {
  const db = createClient()
  const { data, error } = await db.from("vault_keys").select(RECORD_COLUMNS).maybeSingle()
  if (error) throw new Error("Couldn't reach the vault. Check your connection.")
  return data
}

export async function unlockVaultWithPassword(password: string) {
  const record = await fetchVaultRecord()
  if (!record) throw new Error("There is no vault yet.")
  const key = await unlockWithPassword(record.owner_id, record, password)
  unlockVault(key, record.owner_id)
}

export async function unlockVaultWithRecoveryKey(recoveryKey: string) {
  const record = await fetchVaultRecord()
  if (!record) throw new Error("There is no vault yet.")
  const key = await unlockWithRecoveryKey(record.owner_id, record, recoveryKey)
  unlockVault(key, record.owner_id)
}

/** Decrypts one stored value. The vault must be unlocked. */
export async function revealSecret(secretId: string, accountId: string) {
  const { key } = requireVaultKey()
  const db = createClient()
  const { data, error } = await db
    .from("account_secrets")
    .select("ciphertext, iv")
    .eq("id", secretId)
    .eq("account_id", accountId)
    .maybeSingle()
  if (error || !data) throw new Error("Couldn't load that secret. Refresh and try again.")
  return decryptItem(key, { secretId, accountId }, data)
}

/** Encrypts a value for one secret (a new IV every time). The vault must be unlocked. */
export async function sealSecret(secretId: string, accountId: string, value: string) {
  const { key } = requireVaultKey()
  return encryptItem(key, { secretId, accountId }, value)
}
