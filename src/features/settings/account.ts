import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database.types"

/**
 * Account deletion internals (Spec §9.6; Plan P8.1), separated from the action so integration
 * tests can run them against the dev project. Both take a secret-key client.
 */

const BUCKET = "attachments"

/** Every object in the user's attachments folder ({user}/{document}/{file}). */
export async function listUserFiles(admin: SupabaseClient<Database>, userId: string) {
  const paths: string[] = []
  const { data: folders, error } = await admin.storage.from(BUCKET).list(userId, { limit: 1000 })
  if (error) throw new Error("Couldn't list stored files")
  for (const folder of folders ?? []) {
    const { data: files, error: e } = await admin.storage
      .from(BUCKET)
      .list(`${userId}/${folder.name}`, { limit: 1000 })
    if (e) throw new Error("Couldn't list stored files")
    for (const f of files ?? []) paths.push(`${userId}/${folder.name}/${f.name}`)
  }
  return paths
}

/**
 * Deletes the auth user (the database cascades every owned row), then the user's stored files,
 * which no row can reach any more. Returns how many files were removed.
 */
export async function deleteAccountCompletely(admin: SupabaseClient<Database>, userId: string) {
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) throw new Error("Couldn't delete the account")
  // The account is gone either way; file cleanup is best effort and never throws past here.
  try {
    const paths = await listUserFiles(admin, userId)
    for (let i = 0; i < paths.length; i += 100) {
      const { error: e } = await admin.storage.from(BUCKET).remove(paths.slice(i, i + 100))
      if (e) console.error("account deletion: couldn't remove some files")
    }
    return paths.length
  } catch {
    console.error("account deletion: couldn't list stored files")
    return 0
  }
}
