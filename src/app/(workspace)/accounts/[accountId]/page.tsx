import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { ChevronLeft, ExternalLink, Pencil } from "lucide-react"

import { PageContainer } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getMyProfile } from "@/features/profile/queries"
import { AccountDialog } from "@/features/vault/components/account-dialog"
import { CopyLogin } from "@/features/vault/components/accounts-list"
import { DeleteAccountButton } from "@/features/vault/components/delete-account-button"
import { SecretsPanel } from "@/features/vault/components/secrets-panel"
import { VaultBar } from "@/features/vault/components/vault-bar"
import { getAccount, hasVault, listSecretMeta } from "@/features/vault/queries"
import { TWO_FACTOR_LABELS } from "@/features/vault/schemas"

export const metadata: Metadata = { title: "Account" }

/** One account (Plan P11.4): its login, where it's used, and its stored passwords and keys. */
export default function AccountPage({ params }: PageProps<"/accounts/[accountId]">) {
  return (
    <PageContainer className="gap-5">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        {params.then(({ accountId }) => (
          <AccountView accountId={accountId} />
        ))}
      </Suspense>
    </PageContainer>
  )
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  )
}

async function AccountView({ accountId }: { accountId: string }) {
  const [account, secrets, vault, profile] = await Promise.all([
    getAccount(accountId),
    listSecretMeta(accountId),
    hasVault(),
    getMyProfile(),
  ])
  const name = account.label ? `${account.platform} (${account.label})` : account.platform
  const projects = [...new Map(account.services.map((s) => [s.project_id, s])).values()]

  return (
    <>
      <Link
        href="/accounts"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        All accounts
      </Link>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="text-xl font-semibold tracking-tight break-words">{name}</h1>
        <div className="flex items-center gap-2">
          <AccountDialog
            account={account}
            trigger={
              <Button size="sm" variant="outline">
                <Pencil />
                Edit
              </Button>
            }
          />
          <DeleteAccountButton accountId={account.id} name={name} />
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <VaultBar hasVault={vault} />
          <section aria-labelledby="secrets-heading" className="flex flex-col gap-3">
            <h2 id="secrets-heading" className="text-base font-semibold">
              Passwords and keys
            </h2>
            <SecretsPanel
              accountId={account.id}
              secrets={secrets}
              hasVault={vault}
              timeZone={profile.timezone}
            />
          </section>
        </div>

        <aside className="order-first flex flex-col gap-6 lg:order-none lg:border-l lg:pl-6">
          <dl className="flex flex-col gap-3">
            <Detail label="Login">
              {account.login_identifier ? <CopyLogin login={account.login_identifier} /> : "-"}
            </Detail>
            {account.login_url ? (
              <Detail label="Sign in">
                <a
                  href={account.login_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center gap-1 underline-offset-4 hover:underline"
                >
                  <span className="truncate">{account.login_url.replace(/^https?:\/\//, "")}</span>
                  <ExternalLink className="size-3 shrink-0" aria-hidden />
                </a>
              </Detail>
            ) : null}
            <Detail label="Two-factor">{TWO_FACTOR_LABELS[account.two_factor]}</Detail>
            {account.notes ? (
              <Detail label="Notes">
                <span className="whitespace-pre-wrap">{account.notes}</span>
              </Detail>
            ) : null}
          </dl>

          <section aria-labelledby="used-by-heading" className="flex flex-col gap-2">
            <h2 id="used-by-heading" className="text-sm font-semibold">
              Used by
            </h2>
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No project yet. Pick this account when you add or edit a service in a project.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {account.services.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/projects/${s.project_id}/services`}
                      className="underline-offset-4 hover:underline"
                    >
                      {s.project?.name ?? "Project"}
                    </Link>
                    <span className="text-muted-foreground"> · {s.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  )
}
