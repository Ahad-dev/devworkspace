import { z } from "zod"

// Normalize first, then validate: in Zod 4, z.email() checks the format before any later
// .trim() runs, so "  me@x.com " would be rejected instead of cleaned.
const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(320, "Use at most 320 characters")
  .pipe(z.email("Enter a valid email address"))

export const signInSchema = z.object({
  email,
  // Don't enforce password rules on sign-in: a wrong rule would lock the owner out.
  password: z.string().min(1, "Enter your password").max(256),
})

export const resetRequestSchema = z.object({ email })

export const PASSWORD_MIN = 10

export const updatePasswordSchema = z
  .object({
    password: z
      .string()
      .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
      .max(72, "Use at most 72 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  })

export type AuthFormState = {
  status: "idle" | "error" | "success"
  message?: string
  fieldErrors?: Partial<Record<string, string[]>>
  /** Echoed back so a failed submit doesn't clear the email field. Never includes passwords. */
  email?: string
}

export const initialAuthFormState: AuthFormState = { status: "idle" }
