import { readFileSync } from "node:fs"

import { expect, test } from "@playwright/test"
import { unzipSync, strFromU8 } from "fflate"

import { createTestUser, deleteTestUser, type TestUser } from "../support/supabase"
import { signIn } from "./helpers"

/**
 * Plan P8.1; Spec §6.11, FR-14, §9.6: default task view, JSON and documents export, and account
 * deletion (password re-entered). Uses its own throwaway user, which the test deletes.
 */

let user: TestUser

test.beforeAll(async () => {
  user = await createTestUser("settings")
  const c = user.client
  await c.from("profiles").update({ display_name: "Settings Check" }).eq("id", user.id)
  const { data: p } = await c
    .from("projects")
    .insert({ name: "Exported project", project_type: "personal" })
    .select("id")
    .single()
  await c.from("tasks").insert({ project_id: p!.id, title: "Exported task", status: "ready" })
  await c.from("documents").insert({
    project_id: p!.id,
    title: "Exported runbook",
    content_markdown: "# Runbook\n\nUse $DATABASE_URL.",
  })
  await c.auth.signOut()
})

test.afterAll(async () => {
  if (user) await deleteTestUser(user.id) // already gone if the last step passed
})

test("settings: default view, export, account deletion", async ({ page }) => {
  test.setTimeout(240_000)
  await signIn(page, user)

  // Default task view: the board is the default; saving List makes lists open instead, and the
  // Board switch is still one click away.
  await page.goto("/my-work")
  await expect(page.getByRole("button", { name: "Board" })).toHaveAttribute(
    "aria-pressed",
    "true",
    {
      timeout: 30_000,
    },
  )
  await page.goto("/settings")
  await page.getByRole("combobox", { name: "Layout" }).click()
  await page.getByRole("option", { name: "List" }).click()
  await page.getByRole("button", { name: "Save default view" }).click()
  await expect(page.getByText("Default task view saved.")).toBeVisible({ timeout: 30_000 })
  await page.goto("/my-work")
  await expect(page.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true", {
    timeout: 30_000,
  })
  await page.getByRole("button", { name: "Board" }).click()
  await expect(page).toHaveURL(/layout=board/)

  // Security: other sessions can be signed out; this one stays signed in.
  await page.goto("/settings")
  await page.getByRole("button", { name: "Sign out other sessions" }).click()
  await expect(page.getByText("Signed out of every other browser and device")).toBeVisible({
    timeout: 30_000,
  })
  await page.reload()
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible()

  // JSON export: every record, a schema version and the vault notice.
  const json = page.waitForEvent("download")
  await page.getByRole("button", { name: "Download data (JSON)" }).click()
  const jsonFile = await json
  expect(jsonFile.suggestedFilename()).toMatch(/^devworkspace-data-\d{4}-\d{2}-\d{2}\.json$/)
  const data = JSON.parse(readFileSync((await jsonFile.path())!, "utf8"))
  expect(data.schema_version).toBe(2)
  expect(data.notice).toMatch(/does not contain secret values in readable form/)
  expect(data.data.projects.map((p: { name: string }) => p.name)).toEqual(["Exported project"])
  expect(data.data.tasks).toHaveLength(1)
  expect(data.data.documents[0]).not.toHaveProperty("search_vector")
  expect(Object.keys(data.data)).toContain("environment_variables")

  // Documents ZIP: Markdown with front matter.
  const zip = page.waitForEvent("download")
  await page.getByRole("button", { name: "Download documents (ZIP)" }).click()
  const zipFile = await zip
  const entries = unzipSync(readFileSync((await zipFile.path())!))
  const md = Object.keys(entries).find((k) => k.endsWith(".md"))!
  expect(md).toMatch(
    /^documents\/exported-project\/exported-runbook-[0-9a-f]{8}\/exported-runbook\.md$/,
  )
  expect(strFromU8(entries[md]!)).toContain('title: "Exported runbook"')
  expect(Object.keys(entries)).toContain("README.txt")

  // Account deletion: a wrong password changes nothing; the right one deletes everything.
  await page.getByRole("button", { name: "Delete account…" }).click()
  const dialog = page.getByRole("alertdialog", { name: "Delete your account?" })
  const confirmButton = dialog.getByRole("button", { name: "Delete account" })
  await expect(confirmButton).toBeDisabled()
  await dialog.getByLabel("Type DELETE to confirm").fill("DELETE")
  await dialog.getByLabel("Your password").fill("not-the-password")
  await confirmButton.click()
  await expect(dialog.getByText("That password isn't right")).toBeVisible({ timeout: 30_000 })
  await dialog.getByLabel("Your password").fill(user.password)
  await confirmButton.click()
  await expect(page).toHaveURL(/\/login\?deleted=1$/, { timeout: 60_000 })
  await expect(page.getByText("Your account and all of its data were deleted.")).toBeVisible()

  // The account is gone: signing in fails.
  await page.getByLabel("Email", { exact: true }).fill(user.email)
  await page.getByLabel("Password", { exact: true }).fill(user.password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 30_000 })
  await expect(page).toHaveURL(/\/login/)
})
