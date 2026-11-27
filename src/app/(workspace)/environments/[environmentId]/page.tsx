import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { ChevronLeft, ExternalLink, GitCompareArrows } from "lucide-react"

import { EnvironmentBadge } from "@/components/shared/domain-badges"
import { PageContainer } from "@/components/shared/page-header"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getMyProfile } from "@/features/profile/queries"
import {
  EnvironmentStatusBadge,
  NeedsReviewFlag,
  ProductionBanner,
} from "@/features/environments/components/env-badges"
import { EnvironmentActions } from "@/features/environments/components/environment-actions"
import { EnvironmentInstances } from "@/features/environments/components/services-panel"
import { VariablesPanel } from "@/features/environments/components/variables-panel"
import {
  getEnvironment,
  listEnvironmentInstances,
  listEnvironmentVariables,
  listSecretReferences,
  listServiceOptions,
} from "@/features/environments/queries"
import { formatRuntimeVersions, needsReview } from "@/features/environments/utils"
import { hasVault, listVaultItemOptions } from "@/features/vault/queries"
import { ENVIRONMENT_TYPE_META } from "@/lib/constants/domain"
import { formatDateTime } from "@/lib/format"
import { requestTime } from "@/lib/request-time"

export const metadata: Metadata = { title: "Environment" }

/** Environment detail (Spec §6.9; Plan P5.5). */
export default function EnvironmentPage({ params }: PageProps<"/environments/[environmentId]">) {
  return (
    <PageContainer className="gap-5">
      <Suspense fallback={<Skeleton className="h-[36rem] w-full" />}>
        {params.then(({ environmentId }) => (
          <EnvironmentDetail environmentId={environmentId} />
        ))}
      </Suspense>
    </PageContainer>
  )
}

function Section({
  title,
  id,
  action,
  children,
}: {
  title: string
  id: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function Detail({
  label,
  children,
  mono,
}: {
  label: string
  children: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={mono ? "truncate font-mono text-sm" : "text-sm break-words"}>{children}</dd>
    </div>
  )
}

function UrlValue({ href }: { href: string | null }) {
  if (!href) return <span className="text-muted-foreground">-</span>
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-full items-center gap-1 underline-offset-4 hover:underline"
    >
      <span className="truncate">{href.replace(/^https?:\/\//, "")}</span>
      <ExternalLink className="size-3 shrink-0" aria-hidden />
    </a>
  )
}

async function EnvironmentDetail({ environmentId }: { environmentId: string }) {
  const env = await getEnvironment(environmentId)
  const [variables, references, vaultItems, vaultReady, instances, services, profile, renderedAt] =
    await Promise.all([
      listEnvironmentVariables(env.id),
      listSecretReferences(),
      listVaultItemOptions(),
      hasVault(),
      listEnvironmentInstances(env.id),
      listServiceOptions(env.project_id),
      getMyProfile(),
      requestTime(),
    ])
  const tz = profile.timezone
  const archived = env.status === "archived"
  const production = env.environment_type === "production"
  const runtimes = formatRuntimeVersions(env.runtime_versions)
  const dash = <span className="text-muted-foreground">-</span>

  return (
    <>
      <Link
        href={`/projects/${env.project.id}/environments`}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {env.project.name} environments
      </Link>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <EnvironmentBadge
              type={env.environment_type}
              variant="short"
              className="h-6 px-2 text-sm"
            />
            <h1 className="text-xl font-semibold tracking-tight break-words">{env.name}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <EnvironmentStatusBadge status={env.status} />
            {needsReview(env, renderedAt) ? <NeedsReviewFlag /> : null}
            <span>{ENVIRONMENT_TYPE_META[env.environment_type].label}</span>
            <span aria-hidden>·</span>
            <Link
              href={`/projects/${env.project.id}`}
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              {env.project.name}
            </Link>
          </div>
        </div>
        <EnvironmentActions
          environmentId={env.id}
          name={env.name}
          production={production}
          archived={archived}
          counts={{ variables: variables.length, services: instances.length }}
        />
      </header>

      {production ? <ProductionBanner /> : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <Section
            title="Configuration variables"
            id="variables-heading"
            action={
              <Link
                href={`/environments/compare?project=${env.project.id}&envs=${env.id}`}
                className={buttonVariants({ size: "sm", variant: "ghost" })}
              >
                <GitCompareArrows />
                Compare
              </Link>
            }
          >
            <VariablesPanel
              environmentId={env.id}
              variables={variables}
              references={references}
              vaultItems={vaultItems}
              hasVault={vaultReady}
              readOnly={archived}
            />
          </Section>

          <Section title="Uses" id="services-heading">
            <EnvironmentInstances
              projectId={env.project.id}
              environmentId={env.id}
              instances={instances}
              services={services}
              readOnly={archived}
            />
          </Section>

          <Section title="Setup and deployment" id="setup-heading">
            {env.deployment_method ? (
              <p className="text-sm whitespace-pre-wrap">{env.deployment_method}</p>
            ) : null}
            {env.notes ? (
              <p className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                {env.notes}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No setup notes yet.{" "}
                {!archived ? (
                  <Link
                    href={`/environments/${env.id}/edit`}
                    className="underline underline-offset-4"
                  >
                    Add how to set it up and deploy
                  </Link>
                ) : null}
              </p>
            )}
          </Section>
        </div>

        <aside className="order-first flex flex-col gap-4 lg:order-none lg:border-l lg:pl-6">
          <dl className="flex flex-col gap-3">
            <Detail label="Application URL">
              <UrlValue href={env.application_url} />
            </Detail>
            <Detail label="API URL">
              <UrlValue href={env.api_url} />
            </Detail>
            <Detail label="Deployment provider">{env.deployment_provider ?? dash}</Detail>
            <Detail label="Server" mono={Boolean(env.server_hostname)}>
              {env.server_hostname ?? dash}
            </Detail>
            <Detail label="Operating system">{env.operating_system ?? dash}</Detail>
            <Detail label="Runtimes" mono={Boolean(runtimes)}>
              {runtimes || dash}
            </Detail>
            <Detail label="Deployment branch" mono={Boolean(env.deployment_branch)}>
              {env.deployment_branch ?? dash}
            </Detail>
            {env.machine_label ? <Detail label="Machine">{env.machine_label}</Detail> : null}
            <Detail label="Last reviewed">
              {env.last_reviewed_at ? formatDateTime(env.last_reviewed_at, tz) : "Never"}
            </Detail>
            <Detail label="Updated">{formatDateTime(env.updated_at, tz)}</Detail>
          </dl>
        </aside>
      </div>
    </>
  )
}
