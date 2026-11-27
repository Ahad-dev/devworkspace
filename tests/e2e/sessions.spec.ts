import { expect, test, type Page } from "@playwright/test"

import { loadE2EUser } from "./e2e-user"
import { signIn } from "./helpers"

/**
 * Spec FR-07, §5.4–5.5, §6.8; Plan P4.8: start a session, survive a reload, pause with a handoff,
 * see it on the task, resume, switch to another task without overlapping timers, finish.
 */

async function createTask(page: Page, projectId: string, title: string) {
  await page.goto(`/tasks/new?project=${projectId}`)
  await page.getByLabel("Title").fill(title)
  await page.getByRole("button", { name: "Create task" }).click()
  await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]{36}$/, { timeout: 60_000 })
  await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible()
  return page.url()
}

test("work session: start, reload, pause with handoff, resume, switch, finish", async ({
  page,
}) => {
  test.setTimeout(240_000)
  const suffix = Date.now().toString(36)
  const first = `Session task ${suffix}`
  const second = `Second task ${suffix}`
  await signIn(page, loadE2EUser())

  await page.goto("/projects")
  await page.getByRole("button", { name: "New project" }).first().click()
  const dialog = page.getByRole("dialog", { name: "New project" })
  await dialog.getByLabel("Name").fill(`E2E Sessions ${suffix}`)
  await dialog.getByRole("button", { name: "Create project" }).click()
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}$/, { timeout: 60_000 })
  const projectId = page.url().split("/").pop()!

  // Start: the task moves to In Progress and the header shows the running timer.
  const firstUrl = await createTask(page, projectId, first)
  await page.getByRole("button", { name: "Start work" }).click()
  const leftover = page.getByRole("alertdialog", { name: "Another session is running" })
  if (await leftover.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await leftover.getByRole("button", { name: "Finish it and switch" }).click()
  }
  await expect(page.getByText("Working now")).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole("button", { name: `Pause work on ${first}` })).toBeVisible()
  await expect(
    page.getByRole("button", { name: `Status: In Progress. Change status of ${first}` }),
  ).toBeVisible()

  // A reload keeps it running, and the timer ticks from the stored start.
  await page.reload()
  await expect(page.getByText("Working now")).toBeVisible({ timeout: 30_000 })
  const timer = page.getByRole("region", { name: "Work" }).getByRole("timer")
  const before = await timer.textContent()
  await expect(timer).not.toHaveText(before ?? "", { timeout: 5_000 })

  // Pause with a handoff; the next action is copied to the task.
  await page.getByRole("button", { name: "Pause", exact: true }).click()
  const handoff = page.getByRole("dialog", { name: "Pause and hand off" })
  await handoff
    .getByLabel("Next action", { exact: true })
    .fill("Wire the header timer into the layout")
  // Pause is short by default; the full notes are one click away.
  await handoff.getByRole("button", { name: "Add more notes" }).click()
  await handoff.getByLabel("Completed", { exact: true }).fill("Session migrations and RPCs")
  await handoff.getByRole("button", { name: "Add link" }).click()
  await handoff.getByLabel("Link 1 label").fill("PR")
  await handoff.getByLabel("Link 1 URL").fill("https://github.com/acme/app/pull/9")
  await handoff.getByRole("button", { name: "Pause session" }).click()
  await expect(handoff).toBeHidden()

  await expect(page.getByText("Paused", { exact: true })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole("button", { name: `Pause work on ${first}` })).toHaveCount(0)
  const latest = page.getByRole("article").filter({ hasText: "Latest handoff" })
  await expect(latest).toContainText("Session migrations and RPCs")
  await expect(latest.getByRole("link", { name: "PR" })).toHaveAttribute(
    "href",
    "https://github.com/acme/app/pull/9",
  )
  await expect(
    page
      .getByRole("region", { name: "Next action" })
      .getByText("Wire the header timer into the layout"),
  ).toBeVisible()

  // Resume opens a new segment on the same session.
  await page.getByRole("button", { name: "Resume", exact: true }).click()
  await expect(page.getByText("Working now")).toBeVisible({ timeout: 30_000 })

  // Starting on another task offers to pause the running one: no overlapping timers.
  const secondUrl = await createTask(page, projectId, second)
  await page.getByRole("button", { name: "Start work" }).click()
  const switcher = page.getByRole("alertdialog", { name: "Another session is running" })
  await expect(switcher).toContainText(first)
  await switcher.getByRole("button", { name: "Pause it and switch" }).click()
  await expect(page.getByText("Working now")).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole("button", { name: `Pause work on ${second}` })).toBeVisible()

  // Finish the second session; the task offers to resume work later.
  await page.getByRole("button", { name: "Finish", exact: true }).click()
  const finish = page.getByRole("dialog", { name: "Finish session" })
  await finish.getByRole("button", { name: "Finish session" }).click()
  await expect(finish).toBeHidden()
  await expect(page.getByRole("button", { name: "Resume work" })).toBeVisible({ timeout: 30_000 })
  expect(page.url()).toBe(secondUrl)

  // The sessions page lists the paused first task and the finished second one.
  await page.goto("/sessions")
  await expect(page.getByText("Nothing is running.")).toBeVisible({ timeout: 30_000 })
  await expect(
    page.getByRole("region", { name: /^Paused/ }).getByRole("link", { name: first }),
  ).toBeVisible()
  await expect(
    page.getByRole("region", { name: "History" }).getByRole("link", { name: second }),
  ).toBeVisible()

  // The first task still shows its paused session after navigating back.
  await page.goto(firstUrl)
  await expect(page.getByText("Paused", { exact: true })).toBeVisible({ timeout: 30_000 })

  // Clean up: deleting the project removes tasks, sessions and handoffs.
  await page.goto(`/projects/${projectId}`)
  await page.getByRole("button", { name: "More project actions" }).click()
  await page.getByRole("menuitem", { name: "Delete…" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete project" }).click()
  await expect(page).toHaveURL(/\/projects$/)
})
