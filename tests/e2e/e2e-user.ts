import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

/** Throwaway e2e credentials live in playwright/.auth/ (gitignored) only for the run. */
const file = join(process.cwd(), "playwright", ".auth", "e2e-user.json")

export type E2EUser = { id: string; email: string; password: string }

export function saveE2EUser(user: E2EUser) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(user))
}

export function loadE2EUser(): E2EUser {
  if (!existsSync(file)) throw new Error("No e2e user: run through the Playwright setup project.")
  return JSON.parse(readFileSync(file, "utf8")) as E2EUser
}

export function clearE2EUser() {
  rmSync(file, { force: true })
}
