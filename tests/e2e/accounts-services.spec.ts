import { randomUUID } from "node:crypto"

import { expect, test } from "@playwright/test"

import { createVault, encryptItem } from "../../src/features/vault/crypto"
import { createTestUser, deleteTestUser, type TestUser } from "../support/supabase"
import { signIn } from "./helpers"

/**
 * Plan P12.1 and P12.3: add a service to three environments in one step, then point a variable at
 * the vault item that holds its value, and copy that value from the environment page. Its own
 * throwaway user; the vault and its item are made here with the real crypto module.
 */

type Untyped = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (t: string) => any
}

let user: TestUser
const MASTER = `battery staple ${Date.now().toString(36)} horse`
const SECRET = `postgres://app:${randomUUID()}@db.example.com/app`
const seed = { project: "", account: "" }

test.beforeAll(async () => {
  user = await createTestUser("p12-e2e")
  const db = user.client as unknown as Untyped
  const vault = await createVault(user.id, MASTER)
  expect((await db.from("vault_keys").insert(vault.record)).error).toBeNull()
  const { data: account } = await db
    .from("accounts")
    .insert({ platform: "Neon", label: "Work", login_identifier: "me@example.com" })
    .select("id")
    .single()
  seed.account = account.id
  const secretId = randomUUID()
  const sealed = await encryptItem(vault.sessionKey, { secretId, accountId: seed.account }, SECRET)
  const item = await db.from("account_secrets").insert({
    id: secretId,
    account_id: seed.account,
    label: "Database URL",
    kind: "password",
    ...sealed,
  })
  expect(item.error).toBeNull()
  const { data: project } = await db
    .from("projects")
    .insert({ name: "One-step project", project_type: "client" })
    .select("id")
    .single()
  seed.project = project.id
  for (const [name, type] of [
    ["Local", "local"],
    ["Staging", "staging"],
    ["Production", "production"],
  ]) {
    const env = await db
      .from("environments")
      .insert({ project_id: seed.project, name, environment_type: type })
    expect(env.error).toBeNull()
  }
  await user.client.auth.signOut({ scope: "local" })
})

test.afterAll(async () => {
  if (user) await deleteTestUser(user.id)
})

test("one-step service, then a variable whose value is copied from the vault", async ({
  page,
  context,
}) => {
  test.setTimeout(240_000)
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  const sent: string[] = []
  page.on("request", (r) => sent.push(`${r.url()}\n${r.postData() ?? ""}`))

  await signIn(page, user)

  // P12.1: the service, its account and the three environments it runs in, in one dialog.
  await page.goto(`/projects/${seed.project}/services`)
  await expect(page.getByRole("heading", { name: "Accounts & services" })).toBeVisible({
    timeout: 30_000,
  })
  await page.getByRole("button", { name: "Add service" }).click()
  const svc = page.getByRole("dialog", { name: "Add service" })
  await svc.getByLabel("Name").fill("Postgres")
  await svc.getByRole("combobox", { name: "Account" }).click()
  await page.getByRole("option", { name: "Neon (Work)" }).click()
  for (const env of ["Local", "Staging", "Production"]) {
    await svc.getByRole("checkbox", { name: env }).check()
  }
  await svc.getByRole("button", { name: "Add service" }).click()
  await expect(svc).toBeHidden({ timeout: 30_000 })
  // P12.2: grouped under the account it runs under.
  const group = page.getByRole("region", { name: "Neon (Work)" })
  for (const env of ["Local", "Staging", "Production"]) {
    await expect(group.getByRole("button", { name: `Edit Postgres in ${env}` })).toBeVisible({
      timeout: 30_000,
    })
  }

  // P12.3: a Production variable whose value lives in the vault.
  await page.goto(`/projects/${seed.project}/environments`)
  await page.getByRole("link", { name: "Production", exact: true }).first().click()
  await expect(page).toHaveURL(/\/environments\/[0-9a-f-]{36}$/, { timeout: 30_000 })
  // A cold dev server compiles this route on first visit.
  await expect(page.getByRole("heading", { name: "Uses" })).toBeVisible({ timeout: 60_000 })
  await page.getByRole("button", { name: "Add variable" }).click()
  const addVar = page.getByRole("dialog", { name: "Add variable" })
  await addVar.getByLabel("Name", { exact: true }).fill("DATABASE_URL")
  await addVar.getByLabel("Sensitive (a secret)").check()
  await addVar.getByRole("combobox", { name: "Where the value is stored" }).click()
  await page.getByRole("option", { name: "Neon (Work) · Database URL" }).click()
  await addVar.getByRole("button", { name: "Add variable" }).click()
  await expect(addVar).toBeHidden({ timeout: 30_000 })
  await expect(page.getByRole("link", { name: "Neon (Work)" }).first()).toBeVisible({
    timeout: 30_000,
  })
  expect(await page.content()).not.toContain(SECRET)

  // Copy asks to unlock first (a fresh sign-in leaves the vault locked), then copies the value.
  await page.getByRole("button", { name: "Copy DATABASE_URL value" }).click()
  const unlock = page.getByRole("dialog", { name: "Unlock the vault" })
  await unlock.getByLabel("Master password").fill(MASTER)
  await unlock.getByRole("button", { name: "Unlock" }).click()
  await expect(unlock).toBeHidden({ timeout: 30_000 })
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()), { timeout: 30_000 })
    .toBe(SECRET)

  // Show and hide in the row.
  await page.getByRole("button", { name: "Show DATABASE_URL value" }).click()
  await expect(page.getByLabel("DATABASE_URL value", { exact: true })).toHaveText(SECRET)
  await page.getByRole("button", { name: "Hide DATABASE_URL value" }).click()
  await expect(page.getByLabel("DATABASE_URL value", { exact: true })).toHaveCount(0)

  // Compare says where the value is, never the value.
  await page.getByRole("link", { name: "Compare" }).click()
  const row = page.getByRole("row").filter({ hasText: "DATABASE_URL" })
  await expect(row).toContainText("In vault", { timeout: 30_000 })
  await expect(row).not.toContainText(SECRET)

  const traffic = sent.join("\n")
  expect(traffic).not.toContain(SECRET)
  expect(traffic).not.toContain(MASTER)
})
