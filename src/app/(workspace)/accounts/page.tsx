import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { UserRound } from "lucide-react"

import { MoreDetails } from "@/components/shared/more-details"
import { PageContainer, PageHeader } from "@/components/shared/page-header"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { SecretReferencesList } from "@/features/environments/components/secret-references-list"
import { getSecretReferenceUsage, listSecretReferences } from "@/features/environments/queries"
import { AccountDialog } from "@/features/vault/components/account-dialog"
import { AccountsList } from "@/features/vault/components/accounts-list"
import { VaultBar } from "@/features/vault/components/vault-bar"
import { hasVault, listAccounts, listUnlinkedServices } from "@/features/vault/queries"

export const metadata: Metadata = { title: "Accounts" }

/**
 * Accounts (Plan P11.4): which login you use on each platform, which projects use it, and its
 * passwords and keys, kept in the end-to-end encrypted vault.
 */
export default function AccountsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Accounts"
        description="Your logins on Neon, Resend, Vercel and the rest: which projects use each one, and their passwords and keys, encrypted."
        actions={<AccountDialog />}
      />
      <Suspense fallback={<Skeleton className="h-72 w-full" />}>
        <AccountsContent />
      </Suspense>
    </PageContainer>
  )
}

async function AccountsContent() {
  const [vault, accounts, unlinked, references, usage] = await Promise.all([
    hasVault(),
    listAccounts(),
    listUnlinkedServices(),
    listSecretReferences(),
    getSecretReferenceUsage(),
  ])
  return (
    <div className="flex flex-col gap-6">
      <VaultBar hasVault={vault} />

      {accounts.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserRound />
            </EmptyMedia>
            <EmptyTitle>No accounts yet</EmptyTitle>
            <EmptyDescription>
              Add the platforms you sign in to, such as Neon or Resend, then store their passwords
              and API keys and link them to the projects that use them.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <AccountsList accounts={accounts} />
      )}

      {unlinked.length ? (
        <section aria-labelledby="unlinked-heading" className="flex flex-col gap-2">
          <h2 id="unlinked-heading" className="text-base font-semibold">
            Services without an account
          </h2>
          <p className="text-sm text-muted-foreground">
            Edit a service in its project to say which account it runs under.
          </p>
          <ul className="flex flex-col divide-y rounded-lg border text-sm">
            {unlinked.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0 truncate">
                  <span className="font-medium">{s.name}</span>
                  {s.provider ? (
                    <span className="text-muted-foreground"> · {s.provider}</span>
                  ) : null}
                </span>
                <Link
                  href={`/projects/${s.project_id}/services`}
                  className="shrink-0 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  {s.project?.name ?? "Project"}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Plan P12.4: references to secrets kept in another password manager, folded away. */}
      <MoreDetails
        label="Other vaults"
        hint={
          references.length
            ? `${references.length} reference${references.length === 1 ? "" : "s"}`
            : "1Password, Doppler and the like"
        }
      >
        <SecretReferencesList references={references} usage={usage} />
      </MoreDetails>
    </div>
  )
}
