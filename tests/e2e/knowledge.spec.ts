import { expect, test } from "@playwright/test"

import { loadE2EUser } from "./e2e-user"
import { signIn } from "./helpers"

/**
 * Spec FR-10, FR-11, §13.3 journeys 9–10; Plan P6.7: write a project document in Markdown, save
 * with the keyboard, attach and download a private file, then save, flag and copy a command.
 */
test("knowledge: document, attachment, download; command, copy", async ({ page, context }) => {
  test.setTimeout(240_000)
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  const suffix = Date.now().toString(36)
  await signIn(page, loadE2EUser())

  await page.goto("/projects")
  await page.getByRole("button", { name: "New project" }).first().click()
  const newProject = page.getByRole("dialog", { name: "New project" })
  await newProject.getByLabel("Name").fill(`E2E Docs ${suffix}`)
  await newProject.getByRole("button", { name: "Create project" }).click()
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}$/, { timeout: 60_000 })
  const projectId = page.url().split("/").pop()!

  // A new document opens in the editor.
  await page.goto(`/projects/${projectId}/documentation`)
  await page.getByRole("button", { name: "New document" }).first().click()
  const newDoc = page.getByRole("dialog", { name: "New document" })
  await newDoc.getByLabel("Title").fill("Local setup")
  await newDoc.getByRole("combobox", { name: "Category" }).click()
  await page.getByRole("option", { name: "Setup / installation" }).click()
  await newDoc.getByRole("button", { name: "Create document" }).click()
  await expect(page).toHaveURL(/\/knowledge\/documents\/[0-9a-f-]{36}\/edit$/, { timeout: 60_000 })
  const docUrl = page.url().replace(/\/edit$/, "")

  // Write Markdown, preview it, save with Ctrl+S.
  const content = page.getByLabel("Content", { exact: true })
  await content.fill(
    "## Install\n\n1. Run `pnpm install`\n2. Copy `.env.example`\n\n<script>alert(1)</script>\n\n```sh\npnpm dev\n```",
  )
  await expect(page.getByRole("status").getByText("Unsaved changes")).toBeVisible()
  await page.getByRole("button", { name: "Preview", exact: true }).click()
  const preview = page.getByRole("region", { name: "Preview" })
  await expect(preview.getByRole("heading", { name: "Install" })).toBeVisible()
  await page.getByRole("button", { name: "Write", exact: true }).click()
  await content.press("ControlOrMeta+s")
  await expect(page.getByRole("status").getByText(/^Saved/)).toBeVisible({ timeout: 30_000 })

  // In-app links ask before leaving unsaved work.
  await content.fill("## Install\n\nDraft that isn't saved")
  page.once("dialog", (d) => d.dismiss())
  await page.getByRole("link", { name: "Back to document" }).click()
  await expect(page).toHaveURL(/\/edit$/)
  await content.fill(
    "## Install\n\n1. Run `pnpm install`\n2. Copy `.env.example`\n\n<script>alert(1)</script>\n\n```sh\npnpm dev\n```",
  )
  await expect(page.getByRole("status").getByText(/^Saved/)).toBeVisible()

  // The rendered document: Markdown, no raw HTML.
  await page.goto(docUrl)
  await expect(page.getByRole("heading", { name: "Local setup", level: 1 })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Install" })).toBeVisible()
  await expect(page.locator("article script")).toHaveCount(0)
  await expect(page.getByRole("article")).not.toContainText("alert(1)")

  // A private attachment: upload, then download through a short-lived signed URL.
  await page.getByLabel("Choose files to attach").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello from e2e"),
  })
  const files = page.getByRole("list", { name: "Attached files" })
  await expect(files.getByText("notes.txt")).toBeVisible({ timeout: 30_000 })
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "Download notes.txt" }).click()
  expect((await download).suggestedFilename()).toBe("notes.txt")

  // Browsers often give .md files no useful type; the upload still goes in as text/markdown.
  await page.getByLabel("Choose files to attach").setInputFiles({
    name: "setup.md",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("# Setup\n\nRun pnpm install."),
  })
  await expect(files.getByText("setup.md")).toBeVisible({ timeout: 30_000 })

  // A file with a secret in it never leaves the browser.
  await page.getByLabel("Choose files to attach").setInputFiles({
    name: "env.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123456789"),
  })
  await expect(page.getByText(/env\.txt looks like it contains/)).toBeVisible()
  await expect(files.getByText("env.txt")).toHaveCount(0)

  // Search finds it from the knowledge base.
  await page.goto(`/knowledge?q=pnpm`)
  await expect(page.getByRole("link", { name: "Local setup" })).toBeVisible({ timeout: 30_000 })

  // Commands: a destructive one is suggested for the flag, then copied.
  await page.goto(`/projects/${projectId}/documentation?tab=commands`)
  await page.getByRole("button", { name: "New command" }).first().click()
  const cmd = page.getByRole("dialog", { name: "New command" })
  await cmd.getByLabel("Title").fill("Clean build output")
  await cmd.getByLabel("Command", { exact: true }).fill("rm -rf .next")
  await expect(cmd.getByText(/This looks destructive/)).toBeVisible()
  await cmd.getByRole("button", { name: "Mark as destructive" }).click()
  await expect(cmd.getByLabel(/^Destructive/)).toBeChecked()
  await cmd.getByRole("button", { name: "Add command" }).click()
  await expect(cmd).toBeHidden()

  const list = page.getByRole("list", { name: "Commands" })
  const row = list.getByRole("listitem").filter({ hasText: "Clean build output" })
  await expect(row).toBeVisible({ timeout: 30_000 })
  await expect(row.getByText("Destructive")).toBeVisible()
  await expect(row.getByText("Bash")).toBeVisible()
  await row.getByRole("button", { name: "Copy Clean build output" }).click()
  await expect(
    page.getByText("This command is marked destructive.", { exact: false }),
  ).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("rm -rf .next")

  // Clean up: deleting the project removes its documents, commands and files.
  await page.goto(`/projects/${projectId}`)
  await page.getByRole("button", { name: "More project actions" }).click()
  await page.getByRole("menuitem", { name: "Delete…" }).click()
  const confirm = page.getByRole("alertdialog")
  await expect(confirm).toContainText("1 document")
  await expect(confirm).toContainText("1 command")
  await confirm.getByRole("button", { name: "Delete project" }).click()
  await expect(page).toHaveURL(/\/projects$/)
})
