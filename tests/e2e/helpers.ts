import { expect, type Page } from "@playwright/test"

import type { E2EUser } from "./e2e-user"

/** Sign in through the UI; completes onboarding if this is the user's first sign-in. */
export async function signIn(page: Page, user: E2EUser) {
  await page.goto("/login")
  await page.getByLabel("Email").fill(user.email)
  await page.getByLabel("Password").fill(user.password)
  await page.getByRole("button", { name: "Sign in" }).click()
  // Generous: a cold dev server compiles these routes on first request.
  await page.waitForURL(/\/(onboarding|dashboard)$/, { timeout: 60_000 })
  if (page.url().endsWith("/onboarding")) {
    await page.getByLabel("Display name").fill("E2E Tester")
    await page.getByRole("button", { name: "Continue to workspace" }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
  }
}
