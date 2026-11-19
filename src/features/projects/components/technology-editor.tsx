"use client"

import * as React from "react"
import { useActionState } from "react"
import { Loader2, Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  TECHNOLOGY_CATEGORIES,
  TECHNOLOGY_CATEGORY_LABELS,
  type TechnologyCategory,
} from "@/lib/constants/domain"
import { addTechnology, removeTechnology } from "../actions"
import { initialFormState } from "../schemas"

type Tech = {
  id: string
  name: string
  category: TechnologyCategory
  version: string | null
  repository_id: string | null
}

const NO_REPO = "none"

/** Technology stack grouped by category, with inline add/remove (Spec FR-05). */
export function TechnologyEditor({
  projectId,
  technologies,
  repositories,
}: {
  projectId: string
  technologies: Tech[]
  repositories: { id: string; name: string }[]
}) {
  const [state, formAction, pending] = useActionState(
    addTechnology.bind(null, projectId),
    initialFormState,
  )
  const [removing, startRemove] = React.useTransition()
  const formRef = React.useRef<HTMLFormElement>(null)
  const [repoValue, setRepoValue] = React.useState(NO_REPO)

  // Clear the inputs after a successful add.
  React.useEffect(() => {
    if (state.status === "success") formRef.current?.reset()
  }, [state])

  const repoName = new Map(repositories.map((r) => [r.id, r.name]))
  const grouped = TECHNOLOGY_CATEGORIES.map((c) => ({
    category: c,
    items: technologies.filter((t) => t.category === c),
  })).filter((g) => g.items.length > 0)

  const error = state.status === "error" ? (state.fieldErrors?.name?.[0] ?? state.message) : null

  return (
    <div className="flex flex-col gap-4">
      {grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No technologies yet. Add the frameworks, databases and tools this project uses.
        </p>
      ) : (
        <dl className="flex flex-col gap-3">
          {grouped.map((g) => (
            <div key={g.category} className="grid gap-1.5 sm:grid-cols-[10rem_1fr] sm:items-start">
              <dt className="pt-0.5 text-xs font-medium text-muted-foreground">
                {TECHNOLOGY_CATEGORY_LABELS[g.category]}
              </dt>
              <dd className="flex flex-wrap gap-1.5">
                {g.items.map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex h-6 items-center gap-1 rounded-md border bg-muted/40 pr-0.5 pl-2 text-xs"
                  >
                    <span className="font-medium">{t.name}</span>
                    {t.version ? <span className="text-muted-foreground">{t.version}</span> : null}
                    {t.repository_id && repoName.get(t.repository_id) ? (
                      <span className="text-muted-foreground">
                        · {repoName.get(t.repository_id)}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      disabled={removing}
                      onClick={() =>
                        startRemove(() => removeTechnology({ projectId, technologyId: t.id }))
                      }
                      className="ml-0.5 inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                      aria-label={`Remove ${t.name}`}
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <form
        ref={formRef}
        action={formAction}
        className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start"
        noValidate
      >
        <Input
          name="name"
          placeholder="Technology, e.g. Next.js"
          aria-label="Technology name"
          maxLength={100}
          className="sm:w-48"
          aria-invalid={Boolean(error)}
        />
        <Select name="category" defaultValue="frontend">
          <SelectTrigger aria-label="Category" className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TECHNOLOGY_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {TECHNOLOGY_CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          name="version"
          placeholder="Version"
          aria-label="Version (optional)"
          maxLength={50}
          className="sm:w-24"
        />
        {repositories.length > 0 ? (
          <>
            <input
              type="hidden"
              name="repository_id"
              value={repoValue === NO_REPO ? "" : repoValue}
            />
            <Select value={repoValue} onValueChange={setRepoValue}>
              <SelectTrigger aria-label="Repository (optional)" className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_REPO}>Whole project</SelectItem>
                {repositories.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        ) : null}
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus />}
          Add
        </Button>
      </form>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
