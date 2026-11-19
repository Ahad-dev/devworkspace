import type { Metadata } from "next"
import { Suspense } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { ProfileForm } from "@/features/profile/components/profile-form"
import { getMyProfile } from "@/features/profile/queries"

export const metadata: Metadata = { title: "Welcome" }

/** First-run step after sign-in (Spec §5.1 step 3): confirm name and timezone. Requires a session. */
export default function OnboardingPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">Welcome to DevWorkspace</h1>
        <p className="text-sm text-muted-foreground">
          Confirm your name and timezone. You can change both later in Settings.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-56 w-full" />}>
        <OnboardingForm />
      </Suspense>
    </div>
  )
}

async function OnboardingForm() {
  const profile = await getMyProfile()
  return (
    <ProfileForm
      mode="onboarding"
      email={profile.email}
      displayName={profile.displayName}
      timezone={profile.timezone}
    />
  )
}
