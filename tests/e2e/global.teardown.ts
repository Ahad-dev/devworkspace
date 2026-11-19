import { test as teardown } from "@playwright/test"

import { deleteTestUser } from "../support/supabase"
import { clearE2EUser, loadE2EUser } from "./e2e-user"

teardown("delete throwaway e2e user", async () => {
  try {
    const user = loadE2EUser()
    await deleteTestUser(user.id)
  } finally {
    clearE2EUser()
  }
})
