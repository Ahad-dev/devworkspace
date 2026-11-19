import { expect, test } from "@playwright/test"

import { loadE2EUser } from "./e2e-user"

/** Spec FR-01 + §5.1 first-time setup; Plan P1.10. */
test.describe("authentication", () => {
  test("logged-out visitors are sent to sign-in, keeping where they were going", async ({
    page,
  }) => {
    await page.goto("/settings")
    await expect(page).toHaveURL(/\/login\?next=%2Fsettings$/)
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible()
  })

  test("a wrong password shows one generic error", async ({ page }) => {
    const user = loadE2EUser()
    await page.goto("/login")
    await page.getByLabel("Email").fill(user.email)
    await page.getByLabel("Password").fill("definitely-not-the-password")
    await page.getByRole("button", { name: "Sign in" }).click()

    // Not getByRole("alert"): Next's route announcer also has role=alert.
    await expect(page.getByText("Email or password is incorrect.")).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test("first sign-in goes through onboarding, then sign-out returns to sign-in", async ({
    page,
  }, testInfo) => {
    const user = loadE2EUser()
    await page.goto("/login")
    await page.getByLabel("Email").fill(user.email)
    await page.getByLabel("Password").fill(user.password)
    await page.getByRole("button", { name: "Sign in" }).click()

    // A retry may find onboarding already completed by the first attempt.
    if (testInfo.retry === 0) await expect(page).toHaveURL(/\/onboarding$/)
    if (page.url().endsWith("/onboarding")) {
      await expect(page.getByRole("heading", { name: "Welcome to DevWorkspace" })).toBeVisible()
      await page.getByLabel("Display name").fill("E2E Tester")
      await page.getByRole("button", { name: "Continue to workspace" }).click()
    }

    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible()

    await page.getByRole("button", { name: "Account menu" }).click()
    await expect(page.getByRole("menu")).toContainText("E2E Tester")
    await page.getByRole("menuitem", { name: "Sign out" }).click()

    await expect(page).toHaveURL(/\/login$/)
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/)
  })
})
