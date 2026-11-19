import { randomBytes, randomUUID } from "node:crypto"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "../../src/types/database.types"

/**
 * Test-only Supabase helpers. They run against the hosted DEV project, use the secret key from
 * .env.test.local to create and delete throwaway users, and never touch real accounts.
 */

export type TestUser = {
  id: string
  email: string
  password: string
  /** A publishable-key client signed in as this user: RLS applies exactly as in the app. */
  client: SupabaseClient<Database>
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } } as const

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing ${name}. Integration and e2e tests need .env.local and .env.test.local (see README → Testing).`,
    )
  }
  return value
}

/**
 * Refuse to run unless the configured URL is the project named in SUPABASE_TEST_PROJECT_REF.
 * Guards against pointing the secret-key test helpers at the wrong (e.g. production) project.
 */
export function assertDevProject() {
  const url = new URL(requireEnv("NEXT_PUBLIC_SUPABASE_URL"))
  const ref = requireEnv("SUPABASE_TEST_PROJECT_REF")
  if (!url.hostname.startsWith(`${ref}.`)) {
    throw new Error(
      `Refusing to run: NEXT_PUBLIC_SUPABASE_URL (${url.hostname}) is not project ${ref} from SUPABASE_TEST_PROJECT_REF.`,
    )
  }
  if (!requireEnv("SUPABASE_SECRET_KEY").startsWith("sb_secret_")) {
    throw new Error("SUPABASE_SECRET_KEY must be the dev project's secret key (sb_secret_…).")
  }
}

/** Secret-key client: bypasses RLS. Only for creating/deleting test users and verifying cleanup. */
export function adminClient(): SupabaseClient<Database> {
  assertDevProject()
  return createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SECRET_KEY"),
    noSession,
  )
}

/** Publishable-key client with no session: what an anonymous visitor can do. */
export function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    noSession,
  )
}

/** Creates a confirmed throwaway user and returns a client signed in as them. */
export async function createTestUser(label: string): Promise<TestUser> {
  const email = `test-${label}-${randomUUID().slice(0, 8)}@devworkspace.test`
  const password = randomBytes(24).toString("base64url")

  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message ?? "no user"}`)

  const client = anonClient()
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) {
    await deleteTestUser(data.user.id)
    throw new Error(`Test user sign-in failed: ${signInError.message}`)
  }

  return { id: data.user.id, email, password, client }
}

/** Deletes the auth user; the database cascades their profile and owned rows. */
export async function deleteTestUser(id: string) {
  const { error } = await adminClient().auth.admin.deleteUser(id)
  if (error && !/not found/i.test(error.message)) {
    throw new Error(`deleteUser failed: ${error.message}`)
  }
}
