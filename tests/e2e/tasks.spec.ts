import { expect, test, type Page } from "@playwright/test"

import { loadE2EUser } from "./e2e-user"
import { signIn } from "./helpers"

/**
 * Spec FR-06, §6.5–6.7; Plan P3.12: create tasks (quick capture + full form), move one through
 * every status on the board and in the list, and check that Blocked requires details.
 */

async function createProject(page: Page, name: string) {
  await page.goto("/projects")
  await page.getByRole("button", { name: "New project" }).first().click()
  const dialog = page.getByRole("dialog", { name: "New project" })
  await dialog.getByLabel("Name").fill(name)
  await dialog.getByRole("button", { name: "Create project" }).click()
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}$/, { timeout: 60_000 })
  return page.url().split("/").pop()!
}

/** Change status through the card/row status menu (the keyboard-accessible path). */
async function moveWithMenu(page: Page, title: string, to: string) {
  await page.getByRole("button", { name: new RegExp(`Change status of ${title}$`) }).click()
  await page.getByRole("menuitemradio", { name: to, exact: true }).click()
}

/** Wait until the board's optimistic move has been saved (or rolled back). */
async function boardSettled(page: Page) {
  await expect(page.locator('[data-slot="task-board"]')).toHaveAttribute("aria-busy", "false", {
    timeout: 30_000,
  })
}

function column(page: Page, status: string) {
  return page.getByRole("region", { name: new RegExp(`^${status} column`) })
}

test("task lifecycle: capture, full form, board and list moves, blocked details", async ({
  page,
}) => {
  test.setTimeout(240_000)
  const suffix = Date.now().toString(36)
  const quickTitle = `Quick task ${suffix}`
  const fullTitle = `Full task ${suffix}`
  await signIn(page, loadE2EUser())
  const projectId = await createProject(page, `E2E Tasks ${suffix}`)

  // Quick capture from the project's Tasks tab lands in Inbox.
  await page.goto(`/projects/${projectId}/tasks`)
  await page.getByRole("button", { name: "Quick add" }).first().click()
  const quick = page.getByRole("dialog", { name: "Quick add task" })
  await quick.getByLabel("Title").fill(quickTitle)
  await quick.getByRole("button", { name: "Add to Inbox" }).click()
  await expect(quick).toBeHidden()
  await expect(page.getByRole("link", { name: quickTitle })).toBeVisible({ timeout: 30_000 })
  await expect(
    page.getByRole("button", { name: `Status: Inbox. Change status of ${quickTitle}` }),
  ).toBeVisible()

  // Full form defaults to Ready; Blocked needs blocker details.
  await page.goto(`/tasks/new?project=${projectId}`)
  await page.getByLabel("Title").fill(fullTitle)
  await expect(page.getByRole("combobox", { name: "Status" })).toHaveText("Ready")
  await page.getByRole("combobox", { name: "Status" }).click()
  await page.getByRole("option", { name: "Blocked" }).click()
  await page.getByLabel("Next action").fill("Ask for the staging credentials location")
  await page.getByRole("button", { name: "Create task" }).click()
  await expect(page.getByText("Say what's blocking this task")).toBeVisible()
  // The typed title survives the validation error.
  await expect(page.getByLabel("Title")).toHaveValue(fullTitle)
  await page.getByLabel("Blocker details").fill("Waiting for the client to grant repo access")
  await page.getByRole("button", { name: "Create task" }).click()
  await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]{36}$/, { timeout: 60_000 })
  await expect(page.getByRole("heading", { name: fullTitle, level: 1 })).toBeVisible()
  await expect(page.getByText("Waiting for the client to grant repo access")).toBeVisible()
  await expect(page.getByText("Ask for the staging credentials location")).toBeVisible()

  // Detail page: unblock to In Progress, then the next action can be edited.
  await moveWithMenu(page, fullTitle, "In Progress")
  await expect(
    page.getByRole("button", { name: `Status: In Progress. Change status of ${fullTitle}` }),
  ).toBeVisible()
  await page.reload()
  await expect(page.getByText("Waiting for the client to grant repo access")).toHaveCount(0)

  // Board: move the quick task through every status. Drag once, use the menu for the rest.
  await page.goto(`/projects/${projectId}/tasks?layout=board`)
  await expect(column(page, "Inbox").getByRole("link", { name: quickTitle })).toBeVisible({
    timeout: 30_000,
  })

  const handle = page.getByRole("button", { name: `Drag ${quickTitle}` })
  const target = column(page, "Ready")
  const from = (await handle.boundingBox())!
  const to = (await target.boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + 20, from.y + 10, { steps: 5 })
  await page.mouse.move(to.x + to.width / 2, to.y + 80, { steps: 15 })
  await page.mouse.up()
  await expect(target.getByRole("link", { name: quickTitle })).toBeVisible()
  await boardSettled(page)

  await moveWithMenu(page, quickTitle, "In Progress")
  await expect(column(page, "In Progress").getByRole("link", { name: quickTitle })).toBeVisible()
  await boardSettled(page)

  // Blocked from the board asks for details; empty is rejected, cancel keeps the old status.
  await moveWithMenu(page, quickTitle, "Blocked")
  const blocker = page.getByRole("dialog", { name: "What's blocking this task?" })
  await blocker.getByRole("button", { name: "Mark blocked" }).click()
  await expect(blocker.getByText("Say what's blocking this task")).toBeVisible()
  await blocker.getByLabel("Blocker details").fill("Waiting on API rate limit increase")
  await blocker.getByRole("button", { name: "Mark blocked" }).click()
  await expect(column(page, "Blocked").getByRole("link", { name: quickTitle })).toBeVisible()
  await expect(
    column(page, "Blocked").getByText("Waiting on API rate limit increase"),
  ).toBeVisible()
  await boardSettled(page)

  await moveWithMenu(page, quickTitle, "Review")
  await expect(column(page, "Review").getByRole("link", { name: quickTitle })).toBeVisible()
  await boardSettled(page)

  // The board persisted: a reload shows the same column.
  await page.reload()
  await expect(column(page, "Review").getByRole("link", { name: quickTitle })).toBeVisible({
    timeout: 30_000,
  })

  // List: finish it, then it leaves the open queue and shows under Completed.
  await page.goto(`/projects/${projectId}/tasks`)
  await moveWithMenu(page, quickTitle, "Done")
  await expect(page.getByRole("link", { name: quickTitle })).toHaveCount(0, { timeout: 30_000 })
  await page.getByRole("button", { name: "Completed" }).click()
  await expect(page.getByRole("link", { name: quickTitle })).toBeVisible({ timeout: 30_000 })

  // Reopen from the list back to Ready.
  await moveWithMenu(page, quickTitle, "Ready")
  await expect(page.getByRole("link", { name: quickTitle })).toHaveCount(0, { timeout: 30_000 })

  // My Work shows tasks across projects.
  await page.goto("/my-work")
  await expect(page.getByRole("link", { name: quickTitle })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole("link", { name: fullTitle })).toBeVisible()

  // Clean up: deleting the project removes its tasks.
  await page.goto(`/projects/${projectId}`)
  await page.getByRole("button", { name: "More project actions" }).click()
  await page.getByRole("menuitem", { name: "Delete…" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete project" }).click()
  await expect(page).toHaveURL(/\/projects$/)
})
