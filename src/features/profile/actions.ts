"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { DEFAULT_AFTER_LOGIN } from "@/lib/auth/routes"
import { requireUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { profileSchema, type ProfileFormState } from "./schemas"

async function saveProfile(formData: FormData): Promise<ProfileFormState> {
  const parsed = profileSchema.safeParse({
    display_name: formData.get("display_name"),
    timezone: formData.get("timezone"),
  })
  if (!parsed.success) {
    return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const user = await requireUser()
  const supabase = await createClient()
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.display_name, timezone: parsed.data.timezone })
    .eq("id", user.id)

  if (error) {
    // 22023 = invalid timezone, raised by the profiles trigger.
    if (error.code === "22023") {
      return { status: "error", fieldErrors: { timezone: ["Choose a timezone from the list"] } }
    }
    return { status: "error", message: "Couldn't save your profile. Try again." }
  }

  revalidatePath("/", "layout")
  return { status: "success", message: "Profile saved." }
}

export async function updateProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  return saveProfile(formData)
}

export async function completeOnboarding(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const result = await saveProfile(formData)
  if (result.status !== "success") return result
  redirect(DEFAULT_AFTER_LOGIN)
}
