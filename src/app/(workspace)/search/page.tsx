import type { Metadata } from "next"
import { Suspense } from "react"
import Form from "next/form"
import Link from "next/link"
import { Search, SearchX } from "lucide-react"

import { PageContainer, PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Highlighted, SEARCH_KIND_ICONS } from "@/features/search/components/search-highlight"
import { searchWorkspace } from "@/features/search/queries"
import { groupResults, metaLabel, SEARCH_KIND_LABELS } from "@/features/search/utils"

export const metadata: Metadata = { title: "Search" }

/** Full search results (Spec FR-12, §5.7; Plan P7.5): grouped by type, with project context. */
export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <PageContainer>
      <PageHeader
        title="Search"
        description="Projects, tasks, documents, commands, environments, variable names, services, repositories and technologies."
      />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <SearchView searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  )
}

async function SearchView({
  searchParams,
}: {
  searchParams: PageProps<"/search">["searchParams"]
}) {
  const sp = await searchParams
  const raw = Array.isArray(sp.q) ? sp.q[0] : sp.q
  const q = (raw ?? "").trim().slice(0, 100)
  const results = q.length >= 2 ? await searchWorkspace(q, 20) : []
  const groups = groupResults(results)

  return (
    <div className="flex flex-col gap-6">
      <Form action="/search" role="search" className="flex max-w-xl gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            key={q}
            name="q"
            defaultValue={q}
            placeholder="e.g. Redis, DATABASE_URL, migration"
            aria-label="Search"
            className="pl-8"
            autoFocus={!q}
          />
        </div>
        <Button type="submit">Search</Button>
      </Form>

      {q.length < 2 ? (
        <p className="text-sm text-muted-foreground">
          Type at least two characters. Press Ctrl/Cmd+K anywhere to search without leaving the
          page.
        </p>
      ) : groups.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchX />
            </EmptyMedia>
            <EmptyTitle>Nothing matches &ldquo;{q}&rdquo;</EmptyTitle>
            <EmptyDescription>
              Try another word, part of a name (like DATABASE or redis), or fewer words.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <p className="text-sm text-muted-foreground" role="status">
            {results.length} result{results.length === 1 ? "" : "s"} for &ldquo;{q}&rdquo;
          </p>
          {groups.map(([kind, items]) => {
            const Icon = SEARCH_KIND_ICONS[kind]
            return (
              <section
                key={kind}
                aria-labelledby={`search-${kind}`}
                className="flex flex-col gap-2"
              >
                <h2 id={`search-${kind}`} className="flex items-center gap-2 text-sm font-semibold">
                  <Icon className="size-4 text-muted-foreground" aria-hidden />
                  {SEARCH_KIND_LABELS[kind]}
                  <span className="font-normal text-muted-foreground">{items.length}</span>
                </h2>
                <ul className="divide-y rounded-lg border">
                  {items.map((r) => {
                    const meta = metaLabel(r.kind, r.meta)
                    return (
                      <li key={r.id} className="flex flex-col gap-0.5 px-3 py-2.5">
                        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <Link
                            href={r.href}
                            className="min-w-0 truncate text-sm font-medium underline-offset-4 hover:underline"
                          >
                            {r.title}
                          </Link>
                          <span className="text-xs text-muted-foreground">
                            {[
                              r.projectName ??
                                (r.kind === "document" || r.kind === "command" ? "Global" : null),
                              meta,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </div>
                        {r.excerpt ? (
                          <Highlighted
                            text={r.excerpt}
                            className="line-clamp-2 text-sm break-words text-muted-foreground"
                          />
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </>
      )}
    </div>
  )
}
