import "server-only"

import { cache } from "react"

import { requireUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

export type MyProfile = {
  id: string
  email: string | null
  displayName: string | null
  timezone: string
}

/** The signed-in user's profile. RLS limits the row to auth.uid(); the eq() is for the planner. */
export const getMyProfile = cache(async (): Promise<MyProfile> => {
  const user = await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, timezone")
    .eq("id", user.id)
    .maybeSingle()

  if (error) throw new Error("Couldn't load your profile")

  return {
    id: user.id,
    email: user.email,
    displayName: data?.display_name ?? null,
    timezone: data?.timezone ?? "UTC",
  }
})
