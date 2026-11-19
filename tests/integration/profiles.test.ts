import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  adminClient,
  anonClient,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "../support/supabase"

/**
 * M01 `profiles` (Spec FR-01, §9.1–9.2; Plan P1.6/P1.10): bootstrap trigger, owner-only RLS,
 * column-level grants, validation, and cascade on user deletion. Runs against the dev project.
 */
describe("profiles", () => {
  let a: TestUser
  let b: TestUser

  beforeAll(async () => {
    a = await createTestUser("a")
    b = await createTestUser("b")
  })

  afterAll(async () => {
    await Promise.allSettled([a && deleteTestUser(a.id), b && deleteTestUser(b.id)])
  })

  it("creates a profile with safe defaults for every new user", async () => {
    const { data, error } = await a.client
      .from("profiles")
      .select("id, display_name, timezone, preferences")
      .eq("id", a.id)
      .single()

    expect(error).toBeNull()
    expect(data).toEqual({ id: a.id, display_name: null, timezone: "UTC", preferences: {} })
  })

  it("lets a user see only their own profile", async () => {
    const { data, error } = await a.client.from("profiles").select("id")
    expect(error).toBeNull()
    expect(data).toEqual([{ id: a.id }])
  })

  it("hides one user's profile from another user", async () => {
    const { data, error } = await b.client.from("profiles").select("id").eq("id", a.id)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it("ignores another user's attempt to update the profile", async () => {
    const { data, error } = await b.client
      .from("profiles")
      .update({ display_name: "hijacked" })
      .eq("id", a.id)
      .select("id")
    expect(error).toBeNull()
    expect(data).toEqual([])

    const { data: mine } = await a.client
      .from("profiles")
      .select("display_name")
      .eq("id", a.id)
      .single()
    expect(mine?.display_name).toBeNull()
  })

  it("refuses anonymous access entirely", async () => {
    const { error } = await anonClient().from("profiles").select("id")
    expect(error?.code).toBe("42501")
  })

  it("lets the owner update display name and timezone", async () => {
    const { error } = await a.client
      .from("profiles")
      .update({ display_name: "Test User A", timezone: "Asia/Karachi" })
      .eq("id", a.id)
    expect(error).toBeNull()

    const { data } = await a.client
      .from("profiles")
      .select("display_name, timezone")
      .eq("id", a.id)
      .single()
    expect(data).toEqual({ display_name: "Test User A", timezone: "Asia/Karachi" })
  })

  it("rejects an unknown timezone", async () => {
    const { error } = await a.client
      .from("profiles")
      .update({ timezone: "Mars/Olympus_Mons" })
      .eq("id", a.id)
    expect(error?.code).toBe("22023")
  })

  it("rejects preferences that aren't a JSON object", async () => {
    const { error } = await a.client
      .from("profiles")
      .update({ preferences: ["not", "an", "object"] })
      .eq("id", a.id)
    expect(error?.code).toBe("23514")
  })

  it("does not let users change non-editable columns", async () => {
    const { error } = await a.client
      .from("profiles")
      .update({ created_at: "2000-01-01T00:00:00Z" })
      .eq("id", a.id)
    expect(error?.code).toBe("42501")
  })

  it("does not let users insert or delete profiles directly", async () => {
    const insert = await a.client.from("profiles").insert({ id: b.id })
    expect(insert.error?.code).toBe("42501")

    const del = await a.client.from("profiles").delete().eq("id", a.id)
    expect(del.error?.code).toBe("42501")
  })

  it("removes the profile when the auth user is deleted", async () => {
    const c = await createTestUser("c")
    await deleteTestUser(c.id)

    const { data, error } = await adminClient().from("profiles").select("id").eq("id", c.id)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })
})
