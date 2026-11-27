import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

import { createTestUser, deleteTestUser, type TestUser } from "../support/supabase"
import { signIn } from "./helpers"

/**
 * Plan P11.5; docs/SECURITY.md §8: set up the vault, add an account and a password, show, copy,
 * lock and unlock it, and prove from the browser's own traffic that the plaintext, the master
 * password and the recovery key never leave the device. Its own throwaway user.
 */

let user: TestUser
const MASTER = `correct horse ${Date.now().toString(36)} staple`
const SECRET = `pw-${crypto.randomUUID()}`

test.beforeAll(async () => {
  user = await createTestUser("vault-e2e")
  await user.client.from("profiles").update({ display_name: "Vault Check" }).eq("id", user.id)
  await user.client.auth.signOut({ scope: "local" })
})

test.afterAll(async () => {
  if (user) await deleteTestUser(user.id)
})

async function scan(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .exclude("nextjs-portal")
    .analyze()
  expect(
    results.violations.map((v) => `${v.id} (${v.impact})`),
    `${label}: accessibility violations`,
  ).toEqual([])
}

test("vault: set up, store, show, copy, lock; nothing readable leaves the browser", async ({
  page,
  context,
}) => {
  test.setTimeout(240_000)
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  const sent: string[] = []
  page.on("request", (r) => sent.push(`${r.url()}\n${r.postData() ?? ""}`))

  await signIn(page, user)
  await page.goto("/accounts")
  await expect(page.getByRole("heading", { name: "Accounts", level: 1 })).toBeVisible({
    timeout: 30_000,
  })
  await scan(page, "accounts (no vault)")

  // Set up: master password, then the recovery key must be confirmed before anything is stored.
  await page.getByRole("button", { name: "Set up vault" }).click()
  const setup = page.getByRole("dialog", { name: "Set up your password vault" })
  await setup.getByLabel("Master password").fill(MASTER)
  await setup.getByLabel("Repeat it").fill(MASTER)
  await setup.getByRole("button", { name: "Continue" }).click()
  const save = page.getByRole("dialog", { name: "Save your recovery key" })
  const recoveryKey = (await save.getByLabel("Recovery key").textContent())!.trim()
  expect(recoveryKey).toMatch(/^[0-9A-Z]{6}(-[0-9A-Z]{6}){8}$/)
  await save
    .getByLabel("To confirm you saved it, type its last group")
    .fill(recoveryKey.split("-").at(-1)!)
  await save.getByRole("button", { name: "Create vault" }).click()
  await expect(page.getByText("Vault unlocked on this device.")).toBeVisible({ timeout: 30_000 })

  // An account: platform and login are plain metadata.
  await page.getByRole("button", { name: "New account" }).click()
  const acct = page.getByRole("dialog", { name: "New account" })
  await acct.getByLabel("Platform").fill("Neon")
  await acct.getByLabel("Which one").fill("Work")
  await acct.getByLabel("Login email or username").fill("me@example.com")
  await acct.getByRole("button", { name: "Add account" }).click()
  await expect(page.getByRole("heading", { name: "Neon (Work)", level: 1 })).toBeVisible({
    timeout: 30_000,
  })

  // A password, encrypted in the browser before it is saved.
  await page.getByRole("button", { name: "Add a password or key" }).click()
  const add = page.getByRole("dialog", { name: "Add to the vault" })
  await expect(add.getByLabel("Label")).toHaveValue("Password")
  await add.getByLabel("Value").fill(SECRET)
  await add.getByRole("button", { name: "Save" }).click()
  await expect(add).toBeHidden({ timeout: 30_000 })
  await expect(page.getByRole("button", { name: "Show Password" })).toBeVisible({ timeout: 30_000 })
  expect(await page.content()).not.toContain(SECRET)
  await scan(page, "account (unlocked)")

  // Show and hide.
  await page.getByRole("button", { name: "Show Password" }).click()
  await expect(page.getByLabel("Password value")).toHaveText(SECRET)
  await page.getByRole("button", { name: "Hide Password" }).click()
  await expect(page.getByLabel("Password value")).toHaveCount(0)

  // Copy puts the plaintext on the clipboard, and nowhere else.
  await page.getByRole("button", { name: "Copy Password" }).click()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(SECRET)

  // Lock: showing now asks for the master password; a wrong one is refused.
  await page.getByRole("button", { name: "Lock now" }).click()
  await expect(page.getByText("Vault locked.")).toBeVisible()
  await scan(page, "account (locked)")
  await page.getByRole("button", { name: "Show Password" }).click()
  const unlock = page.getByRole("dialog", { name: "Unlock the vault" })
  await unlock.getByLabel("Master password").fill(`${MASTER}x`)
  await unlock.getByRole("button", { name: "Unlock" }).click()
  await expect(unlock.getByText("That master password doesn't open the vault.")).toBeVisible({
    timeout: 30_000,
  })
  await unlock.getByLabel("Master password").fill(MASTER)
  await unlock.getByRole("button", { name: "Unlock" }).click()
  await expect(page.getByLabel("Password value")).toHaveText(SECRET, { timeout: 30_000 })

  // Signing out and back in leaves the vault locked.
  await page.getByRole("button", { name: /^Account menu/ }).click()
  await page.getByRole("menuitem", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/\/login$/)
  await signIn(page, user)
  await page.goto("/accounts")
  await expect(page.getByText("Vault locked.")).toBeVisible({ timeout: 30_000 })

  // The browser's own traffic never carried anything readable.
  const traffic = sent.join("\n")
  expect(traffic).not.toContain(SECRET)
  expect(traffic).not.toContain(MASTER)
  expect(traffic).not.toContain(recoveryKey)
  expect(traffic).not.toContain(recoveryKey.replaceAll("-", ""))
})
