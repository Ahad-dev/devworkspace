import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

import { signIn } from "../e2e/helpers"
import { createTestUser, deleteTestUser, type TestUser } from "../support/supabase"

/**
 * Spec §2.2 "PWA/offline"; Plan P9.5. On a production build: the install files are public, the
 * service worker keeps no workspace pages, the saved copy of tasks reads offline in place of the
 * live pages, an edit made offline says so instead of failing, and signing out deletes the copy.
 */

let user: TestUser
const ids: Record<string, string> = {}
const TITLE = "Offline readable task"

test.describe.configure({ mode: "serial" })

test.beforeAll(async () => {
  user = await createTestUser("pwa")
  const c = user.client
  await c.from("profiles").update({ display_name: "PWA Check" }).eq("id", user.id)
  const { data: project, error } = await c
    .from("projects")
    .insert({ name: "Offline project", project_type: "client" })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  ids.project = project.id
  const { data: task, error: taskError } = await c
    .from("tasks")
    .insert({
      project_id: ids.project,
      title: TITLE,
      status: "in_progress",
      priority: "high",
      next_action: "Check the offline copy",
      description: "Saved **on the device**.",
    })
    .select("id")
    .single()
  if (taskError) throw new Error(taskError.message)
  ids.task = task.id
  await c.from("task_comments").insert({ task_id: ids.task, content: "A comment to read offline" })
  await c.auth.signOut({ scope: "local" })
})

test.afterAll(async () => {
  if (user) await deleteTestUser(user.id)
})

const copyTitles = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const open = indexedDB.open("devworkspace-offline", 1)
        open.onupgradeneeded = () => open.result.createObjectStore("snapshot")
        open.onerror = () => resolve([])
        open.onsuccess = () => {
          const db = open.result
          const get = db.transaction("snapshot").objectStore("snapshot").get("current")
          get.onsuccess = () => {
            db.close()
            const copy = get.result as { tasks?: { title: string }[] } | undefined
            resolve(copy?.tasks?.map((t) => t.title) ?? [])
          }
          get.onerror = () => {
            db.close()
            resolve([])
          }
        }
      }),
  )

async function scan(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze()
  const summary = results.violations.map((v) => `${v.id} (${v.impact})`)
  expect(summary, `${label}: accessibility violations`).toEqual([])
}

test("install files are public; sw.js is never cached", async ({ request }) => {
  for (const path of [
    "/manifest.webmanifest",
    "/sw.js",
    "/offline",
    "/icons/icon-192.png",
    "/icons/maskable-512.png",
    "/apple-icon.png",
  ]) {
    const res = await request.get(path, { maxRedirects: 0 })
    expect(res.status(), path).toBe(200)
  }
  const sw = await request.get("/sw.js")
  expect(sw.headers()["cache-control"]).toBe("no-cache, no-store, must-revalidate")
  expect(sw.headers()["content-security-policy"]).toMatch(/^default-src 'self'; script-src 'self'/)
  expect(await (await request.get("/manifest.webmanifest")).json()).toMatchObject({
    start_url: "/my-work",
    display: "standalone",
  })
})

test("reads the saved copy offline; edits say they need a connection", async ({
  page,
  context,
}) => {
  await signIn(page, user)
  await page.goto("/my-work")
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))
  await expect.poll(() => copyTitles(page), { timeout: 30_000 }).toContain(TITLE)

  // The worker keeps only the offline page and build files, and that page holds no user data.
  const cached = await page.evaluate(async () => {
    const paths: string[] = []
    for (const name of await caches.keys()) {
      for (const req of await (await caches.open(name)).keys())
        paths.push(new URL(req.url).pathname)
    }
    const shell = await caches.match("/offline")
    return { paths, shell: shell ? await shell.text() : "" }
  })
  expect(
    cached.paths.filter((p) => !p.startsWith("/_next/static/") && !p.startsWith("/icons/")),
  ).toEqual(["/offline"])
  expect(cached.shell).not.toContain(user.email)
  expect(cached.shell).not.toContain(TITLE)

  // Offline: reloading a workspace page shows the saved copy in its place.
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole("heading", { name: "My work: All open" })).toBeVisible()
  await expect(page.getByRole("link", { name: TITLE })).toBeVisible()
  await scan(page, "offline queue")

  await page.getByRole("link", { name: TITLE }).click()
  await expect(page).toHaveURL(new RegExp(`/tasks/${ids.task}$`))
  await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible()
  await expect(page.getByText("Check the offline copy")).toBeVisible()
  await expect(page.getByText("A comment to read offline")).toBeVisible()
  await scan(page, "offline task")

  // Back online, the offline page reloads itself into the live page (the status menu appears).
  await context.setOffline(false)
  await expect(
    page.getByRole("button", { name: new RegExp(`Change status of ${TITLE}$`) }),
  ).toBeVisible({ timeout: 30_000 })

  // An edit made after the connection drops says so, and the page stays.
  await context.setOffline(true)
  await expect(page.getByRole("status").filter({ hasText: "You're offline" })).toBeVisible()
  await page.getByRole("button", { name: new RegExp(`Change status of ${TITLE}$`) }).click()
  await page.getByRole("menuitemradio", { name: "Review", exact: true }).click()
  await expect(page.getByText("You're offline. Reconnect to save this change.")).toBeVisible()
  await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible()
  await context.setOffline(false)
})

test("signing out deletes the saved copy", async ({ page }) => {
  await signIn(page, user)
  await page.goto("/my-work")
  await expect.poll(() => copyTitles(page), { timeout: 30_000 }).toContain(TITLE)

  await page.getByRole("button", { name: /^Account menu/ }).click()
  await page.getByRole("menuitem", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect.poll(() => copyTitles(page)).toEqual([])
})
