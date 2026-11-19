import { z } from "zod"

import { isKnownTimezone } from "@/lib/timezones"

export const profileSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, "Enter a display name")
    .max(100, "Use at most 100 characters"),
  timezone: z.string().trim().refine(isKnownTimezone, "Choose a timezone from the list"),
})

export type ProfileInput = z.infer<typeof profileSchema>

export type ProfileFormState = {
  status: "idle" | "error" | "success"
  message?: string
  fieldErrors?: Partial<Record<keyof ProfileInput, string[]>>
}

export const initialProfileFormState: ProfileFormState = { status: "idle" }
