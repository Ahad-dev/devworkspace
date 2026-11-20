import { expect, test, type Page } from "@playwright/test"

import { loadE2EUser } from "./e2e-user"
import { signIn } from "./helpers"

/**
 * Spec FR-08, FR-09, §5.6; Plan P5.9: local and production environments, variables (names only),
 * a secret reference, compare, a service instance, and the typed-name guard on production delete.
 */

async function createEnvironment(page: Page, projectId: string, type: string, name: string) {
  await page.goto(`/projects/${projectId}/environments`)
  await page.getByRole("button", { name: "New environment" }).first().click()
  const dialog = page.getByRole("dialog", { name: "New environment" })
  await dialog.getByRole("combobox", { name: "Type" }).click()
  await page.getByRole("option", { name: type, exact: true }).click()
  await dialog.getByLabel("Name").fill(name)
  await dialog.getByRole("button", { name: "Create environment" }).click()
  await expect(page).toHaveURL(/\/environments\/[0-9a-f-]{36}$/, { timeout: 60_000 })
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible()
  return page.url()
}

test("environments: variables without values, secret refs, compare, services, safe delete", async ({
  page,
}) => {
  test.setTimeout(240_000)
  const suffix = Date.now().toString(36)
  await signIn(page, loadE2EUser())

  await page.goto("/projects")
  await page.getByRole("button", { name: "New project" }).first().click()
  const newProject = page.getByRole("dialog", { name: "New project" })
  await newProject.getByLabel("Name").fill(`E2E Envs ${suffix}`)
  await newProject.getByRole("button", { name: "Create project" }).click()
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}$/, { timeout: 60_000 })
  const projectId = page.url().split("/").pop()!

  // Local environment with a variable pasted as NAME=value: only the name is kept.
  await createEnvironment(page, projectId, "Local", "Local")
  await page.getByRole("button", { name: "Add variable" }).click()
  const addVar = page.getByRole("dialog", { name: "Add variable" })
  await addVar
    .getByLabel("Name", { exact: true })
    .fill("DATABASE_URL=postgres://app:s3cretpass@db.local:5432/app")
  await expect(addVar.getByLabel("Name", { exact: true })).toHaveValue("DATABASE_URL")
  await expect(addVar.getByText(/value after "=" was removed/)).toBeVisible()
  await addVar.getByLabel("Sensitive (a secret)").check()
  await addVar.getByRole("combobox", { name: "Status" }).click()
  await page.getByRole("option", { name: "Configured" }).click()

  // A vault reference instead of a value.
  await addVar.getByRole("button", { name: "New" }).click()
  const ref = page.getByRole("dialog", { name: "New secret reference" })
  await ref.getByLabel("Provider").fill("Doppler")
  await ref.getByLabel("Path or item id").fill("dev")
  await expect(ref.getByLabel("Key name")).toHaveValue("DATABASE_URL")
  await ref.getByRole("button", { name: "Add reference" }).click()
  await expect(ref).toBeHidden()
  await addVar.getByRole("button", { name: "Add variable" }).click()
  await expect(addVar).toBeHidden()
  await expect(page.getByRole("button", { name: "Edit DATABASE_URL", exact: true })).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByText("Manually confirmed")).toBeVisible()
  await expect(page.locator("body")).not.toContainText("s3cretpass")

  // Names-only bulk add: values are dropped before submit.
  await page.getByRole("button", { name: "Add names in bulk" }).click()
  const bulk = page.getByRole("dialog", { name: "Add variable names" })
  await bulk
    .getByLabel("Names")
    .fill("REDIS_URL=rediss://default:tok3nvalue@cache:6379\nSENTRY_DSN")
  await expect(bulk.getByText("1 value will be discarded.")).toBeVisible()
  await bulk.getByRole("button", { name: "Add 2 names" }).click()
  await expect(bulk).toBeHidden()
  await expect(page.getByRole("button", { name: "Edit REDIS_URL", exact: true })).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.locator("body")).not.toContainText("tok3nvalue")

  // Production: clearly marked, with one variable.
  const prodUrl = await createEnvironment(page, projectId, "Production", "Production")
  await expect(page.getByRole("note").getByText("Production.")).toBeVisible()
  await page.getByRole("button", { name: "Add variable" }).click()
  const prodVar = page.getByRole("dialog", { name: "Add variable" })
  await prodVar.getByLabel("Name", { exact: true }).fill("DATABASE_URL")
  await prodVar.getByRole("button", { name: "Add variable" }).click()
  await expect(prodVar).toBeHidden()
  await expect(page.getByRole("button", { name: "Edit DATABASE_URL", exact: true })).toBeVisible({
    timeout: 30_000,
  })

  // Compare: REDIS_URL is required on Local and not registered on Production.
  await page.goto(`/environments/compare?project=${projectId}`)
  const redisRow = page.getByRole("row").filter({ hasText: "REDIS_URL" })
  await expect(redisRow).toContainText("Not registered here", { timeout: 30_000 })
  await expect(page.getByRole("row").filter({ hasText: "DATABASE_URL" })).toContainText(
    "Configured",
  )

  // Services: define Postgres once and link it to Production.
  await page.goto(`/projects/${projectId}/services`)
  await page.getByRole("button", { name: "Add service" }).click()
  const svc = page.getByRole("dialog", { name: "Add service" })
  await svc.getByLabel("Name").fill("Postgres")
  await svc.getByRole("button", { name: "Add service" }).click()
  await expect(svc).toBeHidden()
  await page.getByRole("button", { name: "Add to environment" }).click()
  const inst = page.getByRole("dialog", { name: "Add service to environment" })
  await inst.getByRole("combobox", { name: "Environment" }).click()
  await page.getByRole("option", { name: "Production" }).click()
  await inst.getByLabel("Resource name").fill("portal-prod-db")
  await inst.getByRole("button", { name: "Add", exact: true }).click()
  await expect(inst).toBeHidden()
  await expect(page.getByText("portal-prod-db")).toBeVisible({ timeout: 30_000 })

  // Deleting production needs its name typed.
  await page.goto(prodUrl)
  await page.getByRole("button", { name: "More environment actions" }).click()
  await page.getByRole("menuitem", { name: "Delete…" }).click()
  const confirm = page.getByRole("alertdialog")
  const del = confirm.getByRole("button", { name: "Delete environment" })
  await expect(del).toBeDisabled()
  await confirm.getByLabel(/Type .* to confirm/).fill("Production")
  await del.click()
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/environments$`), {
    timeout: 30_000,
  })
  await expect(page.getByRole("link", { name: "Production" })).toHaveCount(0)

  // Clean up.
  await page.goto(`/projects/${projectId}`)
  await page.getByRole("button", { name: "More project actions" }).click()
  await page.getByRole("menuitem", { name: "Delete…" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete project" }).click()
  await expect(page).toHaveURL(/\/projects$/)
})
