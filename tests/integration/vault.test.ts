import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  createVault,
  decryptItem,
  encryptItem,
  unlockWithPassword,
  type VaultKeyRecord,
} from "../../src/features/vault/crypto"
import { adminClient, createTestUser, deleteTestUser, type TestUser } from "../support/supabase"

/**
 * The Accounts vault against the real database (Plan P11.5; docs/SECURITY.md §8), as throwaway
 * users. The database must only ever hold ciphertext: a marker value is stored through the real
 * crypto module and then searched for, in plain, base64 and hex, in every column the vault touches,
 * in the activity log and in global search.
 */
type Untyped = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (t: string) => any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args: Record<string, unknown>) => any
}
const db = (u: TestUser) => u.client as unknown as Untyped

describe("accounts vault", () => {
  let a: TestUser
  let b: TestUser
  let record: VaultKeyRecord
  let key: CryptoKey
  const marker = `PLAINTEXT-${randomUUID()}`
  const master = `master ${randomUUID()}`
  const ids = { account: "", secret: "", variable: "" }

  beforeAll(async () => {
    a = await createTestUser("vault-a")
    b = await createTestUser("vault-b")
    const vault = await createVault(a.id, master)
    record = vault.record
    key = vault.sessionKey
    const { error } = await db(a).from("vault_keys").insert(record)
    expect(error).toBeNull()

    const { data: account } = await db(a)
      .from("accounts")
      .insert({ platform: "Neon", label: "Work", login_identifier: "me@example.com" })
      .select("id")
      .single()
    ids.account = account.id
    ids.secret = randomUUID()
    const sealed = await encryptItem(key, { secretId: ids.secret, accountId: ids.account }, marker)
    const ins = await db(a)
      .from("account_secrets")
      .insert({
        id: ids.secret,
        account_id: ids.account,
        label: "Password",
        kind: "password",
        ...sealed,
      })
    expect(ins.error).toBeNull()
  })

  afterAll(async () => {
    await Promise.allSettled([a && deleteTestUser(a.id), b && deleteTestUser(b.id)])
  })

  it("stores only ciphertext: the value is nowhere in the database, activity or search", async () => {
    const admin = adminClient() as unknown as Untyped
    const forms = [
      marker,
      Buffer.from(marker).toString("base64"),
      Buffer.from(marker).toString("hex"),
      master,
    ]
    const dump: unknown[] = []
    for (const table of ["vault_keys", "accounts", "account_secrets", "activity_events"]) {
      const { data, error } = await admin.from(table).select("*").eq("owner_id", a.id)
      expect(error).toBeNull()
      dump.push(data)
    }
    const search = await db(a).rpc("global_search", { p_query: "PLAINTEXT", p_limit: 20 })
    dump.push(search.data)
    const text = JSON.stringify(dump)
    for (const f of forms) expect(text).not.toContain(f)
    // The account itself is searchable by its metadata.
    const found = await db(a).rpc("global_search", { p_query: "Neon", p_limit: 5 })
    expect((found.data as { kind: string }[]).some((r) => r.kind === "account")).toBe(true)
  })

  it("decrypts back with the master password, through the owner's own read", async () => {
    const { data: stored } = await db(a)
      .from("vault_keys")
      .select(
        "kdf_iterations, kdf_salt, master_wrapped_key, master_wrap_iv, recovery_salt, recovery_wrapped_key, recovery_wrap_iv",
      )
      .single()
    const unlocked = await unlockWithPassword(a.id, stored, master)
    const { data: sealed } = await db(a)
      .from("account_secrets")
      .select("ciphertext, iv")
      .eq("id", ids.secret)
      .single()
    expect(
      await decryptItem(unlocked, { secretId: ids.secret, accountId: ids.account }, sealed),
    ).toBe(marker)
  })

  it("keeps the bound columns fixed and refuses IV reuse and malformed data", async () => {
    const secrets = db(a).from("account_secrets")
    // Not granted: moving a secret to another account, or forging its owner or dates.
    for (const patch of [
      { account_id: randomUUID() },
      { owner_id: b.id },
      { value_updated_at: new Date(0).toISOString() },
    ]) {
      const { error } = await db(a).from("account_secrets").update(patch).eq("id", ids.secret)
      expect(error?.code).toBe("42501")
    }
    // A new value with the old IV.
    const { data: current } = await secrets.select("iv").eq("id", ids.secret).single()
    const reuse = await db(a)
      .from("account_secrets")
      .update({ ciphertext: "C".repeat(64), iv: current.iv })
      .eq("id", ids.secret)
    expect(reuse.error?.code).toBe("23514")
    // Another row with an IV already used by this owner.
    const dup = await db(a)
      .from("account_secrets")
      .insert({
        id: randomUUID(),
        account_id: ids.account,
        label: "Copy",
        kind: "token",
        ciphertext: "D".repeat(64),
        iv: current.iv,
      })
    expect(dup.error?.code).toBe("23505")
    // Not base64, wrong IV length, too short to be a real ciphertext.
    for (const bad of [
      { ciphertext: "not base64 at all!!".padEnd(64, "!"), iv: "E".repeat(16) },
      { ciphertext: "E".repeat(64), iv: "E".repeat(12) },
      { ciphertext: "E".repeat(8), iv: "F".repeat(16) },
    ]) {
      const { error } = await db(a)
        .from("account_secrets")
        .insert({
          id: randomUUID(),
          account_id: ids.account,
          label: `Bad ${randomUUID()}`,
          kind: "note",
          ...bad,
        })
      expect(error?.code).toBe("23514")
    }
  })

  it("refuses secrets without a vault, and the login field refuses spaces", async () => {
    const { data: account } = await db(b)
      .from("accounts")
      .insert({ platform: "Resend" })
      .select("id")
      .single()
    const noVault = await db(b)
      .from("account_secrets")
      .insert({
        id: randomUUID(),
        account_id: account.id,
        label: "API key",
        kind: "api_key",
        ciphertext: "G".repeat(64),
        iv: "G".repeat(16),
      })
    expect(noVault.error?.code).toBe("23503")
    const spaced = await db(b)
      .from("accounts")
      .insert({ platform: "Vercel", login_identifier: "me hunter2" })
    expect(spaced.error?.code).toBe("23514")
  })

  it("links a project's service to an account; deleting the account unlinks it", async () => {
    const { data: project } = await db(a)
      .from("projects")
      .insert({ name: "Vault project", project_type: "client" })
      .select("id")
      .single()
    const { data: other } = await db(a)
      .from("accounts")
      .insert({ platform: "Neon", label: "Spare" })
      .select("id")
      .single()
    const { data: service, error } = await db(a)
      .from("project_services")
      .insert({
        project_id: project.id,
        name: "Postgres",
        category: "database",
        account_id: other.id,
      })
      .select("id, account:accounts!project_services_account_owner_fkey(platform, label)")
      .single()
    expect(error).toBeNull()
    expect(service.account).toEqual({ platform: "Neon", label: "Spare" })
    // B can't point its own service at A's account.
    const { data: bProject } = await db(b)
      .from("projects")
      .insert({ name: "B project", project_type: "client" })
      .select("id")
      .single()
    const steal = await db(b)
      .from("project_services")
      .insert({ project_id: bProject.id, name: "Stolen", account_id: other.id })
    expect(steal.error?.code).toBe("23503")

    await db(a).from("accounts").delete().eq("id", other.id)
    const { data: after } = await db(a)
      .from("project_services")
      .select("account_id")
      .eq("id", service.id)
      .single()
    expect(after.account_id).toBeNull()
  })

  it("adds a service and the environments it runs in at once, or not at all (P12.1)", async () => {
    const { data: project } = await db(a)
      .from("projects")
      .insert({ name: "One-step project", project_type: "client" })
      .select("id")
      .single()
    const envIds: string[] = []
    for (const [name, type] of [
      ["Local", "local"],
      ["Staging", "staging"],
      ["Production", "production"],
    ]) {
      const { data, error } = await db(a)
        .from("environments")
        .insert({ project_id: project.id, name, environment_type: type })
        .select("id")
        .single()
      expect(error).toBeNull()
      envIds.push(data.id)
    }
    const add = (who: TestUser, args: Record<string, unknown>) =>
      db(who).rpc("add_project_service", {
        p_project_id: project.id,
        p_name: "Resend",
        p_category: "email",
        p_provider: "Resend",
        p_account_id: ids.account,
        p_environment_ids: envIds,
        ...args,
      })

    const ok = await add(a, {})
    expect(ok.error).toBeNull()
    const { data: links } = await db(a)
      .from("service_instances")
      .select("environment_id, status")
      .eq("project_service_id", ok.data)
    expect(links.map((l: { environment_id: string }) => l.environment_id).sort()).toEqual(
      [...envIds].sort(),
    )
    expect(links.every((l: { status: string }) => l.status === "active")).toBe(true)

    // One bad environment id rolls the whole thing back: no half-linked service is left.
    const broken = await add(a, { p_name: "Broken", p_environment_ids: [envIds[0], randomUUID()] })
    expect(broken.error?.code).toBe("23503")
    // Another user can't add to A's project or use A's account.
    const { data: bProject } = await db(b)
      .from("projects")
      .insert({ name: "B one-step", project_type: "client" })
      .select("id")
      .single()
    const foreignAccount = await db(b).rpc("add_project_service", {
      p_project_id: bProject.id,
      p_name: "Broken",
      p_category: "email",
      p_provider: null,
      p_account_id: ids.account,
      p_environment_ids: [],
    })
    expect(foreignAccount.error?.code).toBe("23503")
    const foreignProject = await add(b, {
      p_name: "Broken",
      p_account_id: null,
      p_environment_ids: [],
    })
    expect(foreignProject.error).not.toBeNull()
    const { count } = await adminClient()
      .from("project_services")
      .select("id", { count: "exact", head: true })
      .eq("name", "Broken")
      .in("owner_id", [a.id, b.id])
    expect(count).toBe(0)
  })

  it("points a variable at the vault item that holds its value (P12.3)", async () => {
    const { data: project } = await db(a)
      .from("projects")
      .insert({ name: "Variable project", project_type: "client" })
      .select("id")
      .single()
    const { data: env } = await db(a)
      .from("environments")
      .insert({ project_id: project.id, name: "Production", environment_type: "production" })
      .select("id")
      .single()
    const { data: variable, error } = await db(a)
      .from("environment_variables")
      .insert({ project_id: project.id, environment_id: env.id, name: "DATABASE_URL" })
      .select("id")
      .single()
    expect(error).toBeNull()
    ids.variable = variable.id
    const link = await db(a)
      .from("environment_variables")
      .update({ account_secret_id: ids.secret })
      .eq("id", variable.id)
    expect(link.error).toBeNull()
    // The change is logged by name only.
    const { data: events } = await db(a)
      .from("activity_events")
      .select("metadata")
      .eq("event_type", "variable.updated")
    expect(
      events.some((e: { metadata: { changed?: string[] } }) =>
        e.metadata.changed?.includes("vault_item"),
      ),
    ).toBe(true)

    // B can't point its own variable at A's vault item.
    const { data: bProject } = await db(b)
      .from("projects")
      .insert({ name: "B variables", project_type: "client" })
      .select("id")
      .single()
    const { data: bEnv } = await db(b)
      .from("environments")
      .insert({ project_id: bProject.id, name: "Local", environment_type: "local" })
      .select("id")
      .single()
    const steal = await db(b).from("environment_variables").insert({
      project_id: bProject.id,
      environment_id: bEnv.id,
      name: "DATABASE_URL",
      account_secret_id: ids.secret,
    })
    expect(steal.error?.code).toBe("23503")
  })

  it("resetting the vault deletes the secrets, keeps the accounts, and logs one event", async () => {
    const del = await db(a).from("vault_keys").delete().eq("owner_id", a.id)
    expect(del.error).toBeNull()
    const { count: secrets } = await db(a)
      .from("account_secrets")
      .select("id", { count: "exact", head: true })
    expect(secrets).toBe(0)
    const { count: accounts } = await db(a)
      .from("accounts")
      .select("id", { count: "exact", head: true })
    expect(accounts).toBeGreaterThan(0)
    const { data: events } = await db(a)
      .from("activity_events")
      .select("event_type")
      .in("event_type", ["vault.reset", "account_secret.removed"])
    expect(events.map((e: { event_type: string }) => e.event_type)).toEqual(["vault.reset"])
    // A variable that pointed at a deleted item keeps its name and loses only the link.
    const { data: variable } = await db(a)
      .from("environment_variables")
      .select("name, account_secret_id")
      .eq("id", ids.variable)
      .single()
    expect(variable).toEqual({ name: "DATABASE_URL", account_secret_id: null })
  })
})
