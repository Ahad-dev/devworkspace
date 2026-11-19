import { getMyProfile } from "@/features/profile/queries"
import { getCurrentUser } from "@/lib/auth/session"
import { UserMenu } from "./user-menu"

/** Reads the session, so it must render inside <Suspense> (see AppHeader). */
export async function UserMenuServer() {
  const user = await getCurrentUser()
  if (!user) return <UserMenu email={null} displayName={null} />

  // The menu must never take the page down: fall back to the email if the profile can't load.
  let displayName: string | null = null
  try {
    displayName = (await getMyProfile()).displayName
  } catch {
    displayName = null
  }
  return <UserMenu email={user.email} displayName={displayName} />
}
