import { expect, test } from "@playwright/test"

import { loadE2EUser } from "./e2e-user"
import { signIn } from "./helpers"

/** Spec FR-03/04/05; Plan P2.11: create → repos → stack → archive → restore → delete. */
test("project lifecycle with repositories and technologies", async ({ page }) => {
  // A long end-to-end flow; dev-mode route compilation adds time on a cold server.
  test.setTimeout(180_000)
  const name = `E2E Project ${Date.now().toString(36)}`
  await signIn(page, loadE2EUser())

  // Create with only name + type.
  await page.goto("/projects")
  await expect(page.getByRole("heading", { name: "Projects", level: 1 })).toBeVisible()
  await page.getByRole("button", { name: "New project" }).first().click()
  const dialog = page.getByRole("dialog", { name: "New project" })
  await dialog.getByLabel("Name").fill(name)
  await dialog.getByRole("button", { name: "Create project" }).click()

  // The first visit compiles the route in dev mode; allow for it.
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}$/, { timeout: 60_000 })
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible({ timeout: 30_000 })
  const projectUrl = page.url()

  // Technology stack: add inline.
  await page.getByLabel("Technology name").fill("Next.js")
  await page.getByRole("button", { name: "Add", exact: true }).click()
  await expect(page.getByRole("button", { name: "Remove Next.js" })).toBeVisible()

  // Repositories: two valid remotes, and one with a token that must be rejected.
  await page.getByRole("link", { name: "Repositories", exact: true }).click()
  await expect(page).toHaveURL(/\/repositories$/)

  async function addRepo(repoName: string, remote: string) {
    await page.getByRole("button", { name: "Add repository" }).first().click()
    const d = page.getByRole("dialog", { name: "Add repository" })
    await d.getByLabel("Name").fill(repoName)
    await d.getByLabel("Remote URL").fill(remote)
    await d.getByRole("button", { name: "Add repository" }).click()
    return d
  }

  await addRepo("web", "https://github.com/acme/web")
  await expect(page.getByRole("button", { name: "Actions for web", exact: true })).toBeVisible()
  await addRepo("api", "git@github.com:acme/api.git")
  await expect(page.getByRole("button", { name: "Actions for api", exact: true })).toBeVisible()

  const bad = await addRepo("leaky", "https://ghp_abcdefghijklmnopqrstuvwxyz0123@github.com/acme/x")
  await expect(bad.getByText(/without credentials|Use https:\/\/host/)).toBeVisible()
  await bad.getByRole("button", { name: "Cancel" }).click()
  await expect(page.getByRole("button", { name: "Actions for leaky", exact: true })).toHaveCount(0)

  // Archive → shows under Archived, not Active → restore.
  await page.getByRole("button", { name: "More project actions" }).click()
  await page.getByRole("menuitem", { name: "Archive" }).click()
  await expect(page.getByText("Archived", { exact: true }).first()).toBeVisible()

  await page.goto("/projects")
  await expect(page.getByRole("link", { name })).toHaveCount(0)
  await page.goto("/projects?view=archived")
  await expect(page.getByRole("link", { name })).toBeVisible()

  await page.goto(projectUrl)
  await page.getByRole("button", { name: "More project actions" }).click()
  await page.getByRole("menuitem", { name: "Restore" }).click()
  await expect(page.getByText("Active", { exact: true }).first()).toBeVisible()

  // Activity recorded the lifecycle.
  await page.getByRole("link", { name: "Activity", exact: true }).click()
  await expect(page.getByText(`Restored project ${name}`)).toBeVisible()
  await expect(page.getByText(`Archived project ${name}`)).toBeVisible()
  await expect(page.getByText("Added repository api")).toBeVisible()

  // Delete with confirmation (lists what goes with it).
  await page.getByRole("button", { name: "More project actions" }).click()
  await page.getByRole("menuitem", { name: "Delete…" }).click()
  const confirm = page.getByRole("alertdialog")
  await expect(confirm).toContainText("2 repositories")
  await confirm.getByRole("button", { name: "Delete project" }).click()
  await expect(page).toHaveURL(/\/projects$/)
  await expect(page.getByRole("link", { name })).toHaveCount(0)
})
