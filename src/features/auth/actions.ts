"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import { DEFAULT_AFTER_LOGIN, LOGIN_PATH, ONBOARDING_PATH, safeNextPath } from "@/lib/auth/routes"
import { env } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"
import {
  resetRequestSchema,
  signInSchema,
  updatePasswordSchema,
  type AuthFormState,
} from "./schemas"

const RATE_LIMITED = "Too many attempts. Wait a minute and try again."

function isRateLimited(error: { status?: number; code?: string }) {
  return error.status === 429 || error.code === "over_request_rate_limit"
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const rawEmail = String(formData.get("email") ?? "")
  const parsed = signInSchema.safeParse({
    email: rawEmail,
    password: formData.get("password"),
  })
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      email: rawEmail,
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) {
    // One generic message: never reveal whether the email has an account (Spec FR-01).
    return {
      status: "error",
      message: isRateLimited(error) ? RATE_LIMITED : "Email or password is incorrect.",
      email: rawEmail,
    }
  }

  // First sign-in: send the user to onboarding until they've confirmed name + timezone.
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", data.user.id)
    .maybeSingle()
  if (profile && !profile.display_name) redirect(ONBOARDING_PATH)

  redirect(safeNextPath(String(formData.get("next") ?? ""), DEFAULT_AFTER_LOGIN))
}

export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const rawEmail = String(formData.get("email") ?? "")
  const parsed = resetRequestSchema.safeParse({ email: rawEmail })
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      email: rawEmail,
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    // Built from config, never from the Host header.
    redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/update-password`,
  })
  if (error) {
    // Log the failure without the email address. The user sees the same message either way.
    console.error("Password reset request failed", { code: error.code, status: error.status })
  }

  return {
    status: "success",
    message:
      "If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.",
  }
}

export async function updatePassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  })
  if (!parsed.success) {
    return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) {
    if (error.code === "same_password") {
      return { status: "error", message: "Choose a password different from your current one." }
    }
    if (error.code === "weak_password") {
      return { status: "error", message: "That password is too weak. Try a longer one." }
    }
    if (error.code === "session_not_found" || error.status === 401) {
      return {
        status: "error",
        message: "Your reset link has expired. Request a new one from the sign-in page.",
      }
    }
    return { status: "error", message: "Couldn't update your password. Try again." }
  }

  redirect(DEFAULT_AFTER_LOGIN)
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect(LOGIN_PATH)
}
