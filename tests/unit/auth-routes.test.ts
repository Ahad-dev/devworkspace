import { describe, expect, it } from "vitest"

import { isGuestOnlyPath, isPublicPath, safeNextPath } from "@/lib/auth/routes"

describe("safeNextPath (open-redirect guard)", () => {
  it.each([
    ["/projects", "/projects"],
    ["/projects?status=active#top", "/projects?status=active#top"],
    ["/update-password", "/update-password"],
  ])("keeps same-origin path %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected)
  })

  it.each([
    [null],
    [undefined],
    [""],
    ["dashboard"],
    ["//evil.example"],
    ["/\\evil.example"],
    ["https://evil.example/path"],
    ["javascript:alert(1)"],
  ])("falls back for unsafe value %s", (input) => {
    expect(safeNextPath(input)).toBe("/dashboard")
    expect(safeNextPath(input, "/settings")).toBe("/settings")
  })
})

describe("isPublicPath", () => {
  it.each(["/login", "/reset-password", "/auth/confirm", "/auth/anything"])(
    "allows %s without a session",
    (path) => {
      expect(isPublicPath(path)).toBe(true)
    },
  )

  it.each(["/", "/dashboard", "/settings", "/update-password", "/onboarding", "/loginx", "/auth"])(
    "requires a session for %s",
    (path) => {
      expect(isPublicPath(path)).toBe(false)
    },
  )
})

describe("isGuestOnlyPath", () => {
  it("sends signed-in users away from sign-in pages only", () => {
    expect(isGuestOnlyPath("/login")).toBe(true)
    expect(isGuestOnlyPath("/reset-password")).toBe(true)
    expect(isGuestOnlyPath("/update-password")).toBe(false)
    expect(isGuestOnlyPath("/auth/confirm")).toBe(false)
  })
})
