import { expect, test } from "@playwright/test"

import { loadE2EUser } from "./e2e-user"
import { signIn } from "./helpers"

/**
 * Spec FR-02, FR-12, §13.3 journey 11; Plan P7.8: quick-create from the dashboard, its counts and
 * current focus, then Ctrl/Cmd+K search for "Redis" opens the service with project context.
 */
test("dashboard quick actions, focus and global search", async ({ page }) => {
  test.setTimeout(240_000)
  const suffix = Date.now().toString(36)
  const projectName = `E2E Overview ${suffix}`
  const taskTitle = `Tune cache eviction ${suffix}`
  await signIn(page, loadE2EUser())

  // A project from the dashboard's quick actions.
  await page.goto("/dashboard")
  const actions = page.getByRole("group", { name: "Quick actions" })
  await actions.getByRole("button", { name: "New project" }).click()
  const newProject = page.getByRole("dialog", { name: "New project" })
  await newProject.getByLabel("Name").fill(projectName)
  await newProject.getByRole("button", { name: "Create project" }).click()
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}$/, { timeout: 60_000 })
  const projectId = page.url().split("/").pop()!
  // Let the redirect finish rendering; navigating mid-redirect aborts the next page load.
  await expect(page.getByRole("heading", { name: projectName, level: 1 })).toBeVisible({
    timeout: 30_000,
  })

  // A service whose name we'll search for.
  await page.goto(`/projects/${projectId}/services`)
  await page.getByRole("button", { name: "Add service" }).first().click()
  const svc = page.getByRole("dialog", { name: "Add service" })
  await svc.getByLabel("Name").fill("Redis cache")
  await svc.getByRole("button", { name: "Add service" }).click()
  await expect(svc).toBeHidden()

  // A task from the dashboard lands in the Inbox count.
  await page.goto("/dashboard")
  await actions.getByRole("button", { name: "New task" }).click()
  const quick = page.getByRole("dialog", { name: "Quick add task" })
  await quick.getByLabel("Title").fill(taskTitle)
  await quick.getByRole("combobox", { name: "Project" }).click()
  await page.getByRole("option", { name: projectName }).click()
  await quick.getByRole("button", { name: "Add to Inbox" }).click()
  await expect(quick).toBeHidden({ timeout: 30_000 })
  const attention = page.getByRole("region", { name: "Attention required" })
  await expect(attention.getByRole("link", { name: /Inbox to triage\s*[1-9]/ })).toBeVisible({
    timeout: 30_000,
  })

  // Start a session from the dashboard; it becomes the current focus.
  await actions.getByRole("button", { name: "Start session" }).click()
  const start = page.getByRole("dialog", { name: "Start a work session" })
  await start.getByRole("combobox", { name: "Task" }).click()
  await page.getByRole("option", { name: new RegExp(taskTitle) }).click()
  await start.getByRole("button", { name: "Start session" }).click()
  await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]{36}$/, { timeout: 30_000 })
  await page.goto("/dashboard")
  const focus = page.getByRole("region", { name: "Current focus" })
  await expect(focus.getByText("Working on")).toBeVisible()
  await expect(focus.getByRole("link", { name: taskTitle })).toBeVisible()
  await expect(focus.getByRole("timer")).toBeVisible()
  await expect(
    page.getByRole("region", { name: "Work queue" }).getByRole("link", { name: taskTitle }),
  ).toBeVisible()

  // Ctrl/Cmd+K: search "Redis" and open the service in its project.
  await page.keyboard.press("ControlOrMeta+k")
  const palette = page.getByRole("dialog", { name: "Search" })
  await palette.getByRole("combobox").fill("Redis")
  const result = palette.getByRole("option", { name: /Redis cache/ })
  await expect(result).toBeVisible({ timeout: 30_000 })
  await expect(result).toContainText(projectName)
  await result.click()
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/services$`))

  // The full results page groups by type.
  await page.goto(`/search?q=${encodeURIComponent("Redis")}`)
  const services = page.getByRole("region", { name: /Services/ })
  await expect(services.getByRole("link", { name: "Redis cache" })).toBeVisible()
  await expect(page.getByRole("region", { name: /Tasks/ })).toHaveCount(0)

  // The global activity feed shows what happened, with project context.
  await page.goto("/activity")
  await expect(page.getByText(`Created task ${taskTitle}`).first()).toBeVisible()

  // Clean up: deleting the project also removes its session.
  await page.goto(`/projects/${projectId}`)
  await page.getByRole("button", { name: "More project actions" }).click()
  await page.getByRole("menuitem", { name: "Delete…" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete project" }).click()
  await expect(page).toHaveURL(/\/projects$/)
})
