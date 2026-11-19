import { describe, expect, it } from "vitest"

import { resetRequestSchema, signInSchema, updatePasswordSchema } from "@/features/auth/schemas"
import { profileSchema } from "@/features/profile/schemas"

describe("signInSchema", () => {
  it("normalizes the email", () => {
    const parsed = signInSchema.parse({ email: "  Owner@Example.COM ", password: "x" })
    expect(parsed.email).toBe("owner@example.com")
  })

  it("rejects a malformed email and an empty password", () => {
    const result = signInSchema.safeParse({ email: "not-an-email", password: "" })
    expect(result.success).toBe(false)
    const fields = result.error?.issues.map((i) => i.path[0])
    expect(fields).toEqual(expect.arrayContaining(["email", "password"]))
  })

  it("does not apply password-strength rules at sign-in", () => {
    expect(signInSchema.safeParse({ email: "a@b.co", password: "short" }).success).toBe(true)
  })
})

describe("resetRequestSchema", () => {
  it("requires a valid email", () => {
    expect(resetRequestSchema.safeParse({ email: "a@b.co" }).success).toBe(true)
    expect(resetRequestSchema.safeParse({ email: "nope" }).success).toBe(false)
  })
})

describe("updatePasswordSchema", () => {
  it("accepts 10–72 characters that match", () => {
    const pw = "a".repeat(10)
    expect(updatePasswordSchema.safeParse({ password: pw, confirm: pw }).success).toBe(true)
  })

  it("rejects short, overlong and mismatched passwords", () => {
    expect(updatePasswordSchema.safeParse({ password: "short", confirm: "short" }).success).toBe(
      false,
    )
    const long = "a".repeat(73)
    expect(updatePasswordSchema.safeParse({ password: long, confirm: long }).success).toBe(false)

    const mismatch = updatePasswordSchema.safeParse({
      password: "a".repeat(12),
      confirm: "b".repeat(12),
    })
    expect(mismatch.success).toBe(false)
    expect(mismatch.error?.issues[0]?.path).toEqual(["confirm"])
  })
})

describe("profileSchema", () => {
  it("trims the display name and accepts known timezones", () => {
    expect(profileSchema.parse({ display_name: "  Ada  ", timezone: "Asia/Karachi" })).toEqual({
      display_name: "Ada",
      timezone: "Asia/Karachi",
    })
    expect(profileSchema.safeParse({ display_name: "Ada", timezone: "UTC" }).success).toBe(true)
  })

  it("rejects empty or overlong names and unknown timezones", () => {
    expect(profileSchema.safeParse({ display_name: "   ", timezone: "UTC" }).success).toBe(false)
    expect(
      profileSchema.safeParse({ display_name: "x".repeat(101), timezone: "UTC" }).success,
    ).toBe(false)
    expect(profileSchema.safeParse({ display_name: "Ada", timezone: "Mars/Base" }).success).toBe(
      false,
    )
  })
})
