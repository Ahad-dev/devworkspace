import { test as setup } from "@playwright/test"

import { assertDevProject, createTestUser } from "../support/supabase"
import { saveE2EUser } from "./e2e-user"

setup("create throwaway e2e user", async () => {
  assertDevProject()
  const user = await createTestUser("e2e")
  // The signed-in API client isn't needed: the browser signs in through the UI.
  await user.client.auth.signOut()
  saveE2EUser({ id: user.id, email: user.email, password: user.password })
})
