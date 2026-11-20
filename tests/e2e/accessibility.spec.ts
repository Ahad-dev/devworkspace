import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

import { createTestUser, deleteTestUser, type TestUser } from "../support/supabase"
import { signIn } from "./helpers"

/**
 * Plan P8.4; Spec §13.4, §18: axe on every main page (light and dark), a keyboard-only
 * walkthrough, and the phone-width task update and handoff flow. Uses its own throwaway user with
 * content seeded through the API, so every page has something to check.
 */

let user: TestUser
const ids: Record<string, string> = {}

test.beforeAll(async () => {
  user = await createTestUser("a11y")
  const c = user.client
  await c.from("profiles").update({ display_name: "A11y Check" }).eq("id", user.id)
  const one = async (q: PromiseLike<{ data: unknown; error: { message: string } | null }>) => {
    const { data, error } = await q
    if (error) throw new Error(error.message)
    return (data as { id: string }).id
  }
  ids.project = await one(
    c
      .from("projects")
      .insert({
        name: "Accessible Portal",
        project_type: "client",
        description: "## About\n\nA **client portal** with [docs](https://example.com).",
      })
      .select("id")
      .single(),
  )
  await c.from("repositories").insert({ project_id: ids.project, name: "web" })
  await c
    .from("project_technologies")
    .insert({ project_id: ids.project, name: "Next.js", category: "frontend" })
  ids.task = await one(
    c
      .from("tasks")
      .insert({
        project_id: ids.project,
        title: "Fix the login redirect",
        status: "ready",
        priority: "high",
        description: "Steps:\n\n1. Sign out\n2. Open a deep link",
        due_at: new Date(Date.now() + 2 * 86_400_000).toISOString(),
      })
      .select("id")
      .single(),
  )
  await c.from("tasks").insert({
    project_id: ids.project,
    title: "Blocked thing",
    status: "blocked",
    blocker_details: "Waiting on access",
  })
  ids.env = await one(
    c
      .from("environments")
      .insert({ project_id: ids.project, name: "Production", environment_type: "production" })
      .select("id")
      .single(),
  )
  await c.from("environment_variables").insert({
    project_id: ids.project,
    environment_id: ids.env,
    name: "DATABASE_URL",
    is_sensitive: true,
  })
  await c
    .from("project_services")
    .insert({ project_id: ids.project, name: "Postgres", category: "database" })
  ids.doc = await one(
    c
      .from("documents")
      .insert({
        project_id: ids.project,
        title: "Local setup",
        category: "setup",
        content_markdown:
          "# Setup\n\n```sh\npnpm install\n```\n\n| Step | Command |\n| - | - |\n| 1 | `pnpm dev` |",
      })
      .select("id")
      .single(),
  )
  await c.from("command_snippets").insert({
    project_id: ids.project,
    title: "Start dev",
    command_text: "pnpm dev",
    environment_id: ids.env,
  })
  await c.auth.signOut()
})

test.afterAll(async () => {
  if (user) await deleteTestUser(user.id)
})

async function scan(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    // The Next.js dev-tools badge is development-only chrome, not app UI.
    .exclude("nextjs-portal")
    .analyze()
  const summary = results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.nodes
        .map((n) => `${n.target.join(" ")} ${n.html.slice(0, 160)}`)
        .slice(0, 3)
        .join(" | ")}`,
  )
  expect(summary, `${label}: accessibility violations`).toEqual([])
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle")
  // Skeletons are replaced by content; no loading placeholders remain.
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0, { timeout: 30_000 })
  // A scan of the error screen would prove nothing about the page.
  await expect(page.getByText("Something went wrong")).toHaveCount(0)
}

test("axe: no violations on the main pages, light and dark", async ({ page }) => {
  test.setTimeout(600_000)
  await page.goto("/login")
  await scan(page, "login")
  await signIn(page, user)

  const pages = [
    "/dashboard",
    "/my-work",
    "/my-work?layout=board",
    "/projects",
    `/projects/${ids.project}`,
    `/projects/${ids.project}/tasks`,
    `/projects/${ids.project}/repositories`,
    `/tasks/${ids.task}`,
    "/sessions",
    "/environments",
    `/environments/${ids.env}`,
    `/environments/compare?project=${ids.project}`,
    "/services",
    "/knowledge",
    "/knowledge?tab=commands",
    `/knowledge/documents/${ids.doc}`,
    `/knowledge/documents/${ids.doc}/edit`,
    "/search?q=portal",
    "/activity",
    "/settings",
  ]
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    for (const path of pages) {
      await page.goto(path)
      await settle(page)
      await scan(page, `${path} (${scheme})`)
    }
  }

  // Dialogs: the search palette and a create dialog.
  await page.emulateMedia({ colorScheme: "light" })
  await page.goto("/dashboard")
  await settle(page)
  await page.keyboard.press("ControlOrMeta+k")
  await page.getByRole("dialog", { name: "Search" }).getByRole("combobox").fill("portal")
  await expect(page.getByRole("option", { name: /Accessible Portal/ })).toBeVisible({
    timeout: 30_000,
  })
  await scan(page, "search palette")
  await page.keyboard.press("Escape")
  await page
    .getByRole("group", { name: "Quick actions" })
    .getByRole("button", { name: "New task" })
    .click()
  await expect(page.getByRole("dialog", { name: "Quick add task" })).toBeVisible()
  await scan(page, "quick add task dialog")
})

test("keyboard only: skip link, search palette, status change", async ({ page }) => {
  test.setTimeout(180_000)
  await signIn(page, user)
  await page.goto("/dashboard")
  await settle(page)

  // The first Tab stop skips past the sidebar and header.
  await page.keyboard.press("Tab")
  const skip = page.getByRole("link", { name: "Skip to main content" })
  await expect(skip).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(page.locator("main#main")).toBeFocused()

  // Search and open a result without the mouse.
  await page.keyboard.press("ControlOrMeta+k")
  await page.keyboard.type("login redirect")
  await expect(page.getByRole("option", { name: /Fix the login redirect/ })).toBeVisible({
    timeout: 30_000,
  })
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(new RegExp(`/tasks/${ids.task}$`), { timeout: 30_000 })

  // Change the status through the menu with the keyboard.
  const status = page.getByRole("button", { name: /Change status of Fix the login redirect$/ })
  await status.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("menuitemradio", { name: "Review", exact: true })).toBeVisible()
  await page.getByRole("menuitemradio", { name: "Review", exact: true }).focus()
  await page.keyboard.press("Enter")
  await expect(
    page.getByRole("button", { name: "Status: Review. Change status of Fix the login redirect" }),
  ).toBeVisible({ timeout: 30_000 })
})

test("phone width: update a task and pause with a handoff", async ({ page }) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, user)
  await page.goto(`/tasks/${ids.task}`)
  await settle(page)
  const noOverflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    )
  expect(await noOverflow()).toBe(true)

  await page.getByRole("button", { name: "Start work" }).click()
  await expect(page.getByText("Working now")).toBeVisible({ timeout: 30_000 })
  await page.getByRole("button", { name: "Pause", exact: true }).click()
  const handoff = page.getByRole("dialog", { name: "Pause and hand off" })
  await handoff.getByLabel("Next action", { exact: true }).fill("Write the redirect test")
  await handoff.getByRole("button", { name: "Pause session" }).click()
  await expect(handoff).toBeHidden({ timeout: 30_000 })
  await expect(page.getByText("Paused", { exact: true })).toBeVisible({ timeout: 30_000 })
  await expect(
    page.getByRole("region", { name: "Next action" }).getByText("Write the redirect test"),
  ).toBeVisible()
  expect(await noOverflow()).toBe(true)

  // The overview reads well on a phone too.
  await page.goto("/dashboard")
  await settle(page)
  expect(await noOverflow()).toBe(true)
  await scan(page, "dashboard (phone)")
})
