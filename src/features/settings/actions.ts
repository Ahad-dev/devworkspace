"use server"

import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import type { FormState } from "@/features/projects/schemas"
import { TASK_SORTS } from "@/features/tasks/utils"
import { requireUser } from "@/lib/auth/session"
import { env } from "@/lib/env"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database.types"
import { deleteAccountCompletely } from "./account"

/** Settings actions (Spec §6.11, §9.6, FR-14; Plan P8.1). */

const taskViewSchema = z.object({
  layout: z.enum(["list", "board"], "Choose a layout"),
  sort: z.enum(TASK_SORTS, "Choose a sort order"),
})

export async function saveTaskViewDefaults(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = taskViewSchema.safeParse({
    layout: formData.get("layout"),
    sort: formData.get("sort"),
  })
  if (!parsed.success) {
    return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }
  const user = await requireUser()
  const supabase = await createClient()
  const { data } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", user.id)
    .maybeSingle()
  const current =
    data?.preferences && typeof data.preferences === "object" && !Array.isArray(data.preferences)
      ? data.preferences
      : {}
  const { error } = await supabase
    .from("profiles")
    .update({ preferences: { ...current, task_view: parsed.data } })
    .eq("id", user.id)
  if (error) return { status: "error", message: "Couldn't save. Try again." }
  revalidatePath("/", "layout")
  return { status: "success", message: "Default task view saved." }
}

/** Ends every other signed-in session (other browsers and devices); this one stays. */
export async function signOutOtherSessions(): Promise<{ ok: boolean; error?: string }> {
  await requireUser()
  const supabase = await createClient()
  const { error } = await supabase.auth.signOut({ scope: "others" })
  if (error) return { ok: false, error: "Couldn't sign out other sessions. Try again." }
  return { ok: true }
}

/**
 * Deletes the account and everything in it after the password is re-entered and DELETE typed.
 * Vault secrets are untouched: DevWorkspace never held them.
 */
export async function deleteAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const confirmation = String(formData.get("confirm") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  const fieldErrors: Record<string, string[]> = {}
  if (confirmation !== "DELETE") fieldErrors.confirm = ["Type DELETE to confirm"]
  if (!password) fieldErrors.password = ["Enter your password"]
  if (Object.keys(fieldErrors).length) return { status: "error", fieldErrors }

  const user = await requireUser()
  if (!user.email) return { status: "error", message: "This account has no email to confirm with." }
  const admin = createAdminClient()
  if (!admin) {
    return {
      status: "error",
      message: "Account deletion isn't set up on this server yet (it needs the server key).",
    }
  }

  // Re-authenticate on a separate, non-persisting client so the browser session is untouched.
  const verifier = createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const { error: authError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password,
  })
  if (authError)
    return { status: "error", fieldErrors: { password: ["That password isn't right"] } }

  try {
    await deleteAccountCompletely(admin, user.id)
  } catch {
    return {
      status: "error",
      message: "Couldn't delete the account. Nothing was removed; try again.",
    }
  }

  // The user no longer exists; clear this browser's session cookies.
  const supabase = await createClient()
  await supabase.auth.signOut({ scope: "local" }).catch(() => {})
  redirect("/login?deleted=1")
}
