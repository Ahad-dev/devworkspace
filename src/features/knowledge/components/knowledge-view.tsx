import { requestTime } from "@/lib/request-time"
import { listCommands, listDocuments, listLinkOptions, parseKnowledgeFilters } from "../queries"
import { CommandDialogButton, CommandsList } from "./commands-panel"
import { CreateDocumentDialog } from "./create-document-dialog"
import { DocumentsTable } from "./documents-table"
import { KnowledgeFilters } from "./knowledge-filters"

/**
 * Documents and commands, filtered by the URL (Plan P6.4). Global on /knowledge; scoped to one
 * project on its Documentation tab. Render inside <Suspense>: it reads search params.
 */
export async function KnowledgeView({
  searchParams,
  projectId,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
  projectId?: string
}) {
  const filters = parseKnowledgeFilters(await searchParams)
  const [options, renderedAt] = await Promise.all([listLinkOptions(), requestTime()])
  const activeProjects = options.projects.filter((p) => p.status !== "archived")
  const createProject = projectId ?? (filters.project !== "global" ? filters.project : null)

  const results =
    filters.tab === "commands" ? (
      <CommandsList
        commands={await listCommands(filters, { projectId })}
        options={options}
        projectId={projectId}
        showProject={!projectId}
        filtered={Boolean(filters.q || filters.commandCategory || (!projectId && filters.project))}
      />
    ) : (
      <DocumentsTable
        rows={await listDocuments(filters, { projectId })}
        filters={filters}
        showProject={!projectId}
        renderedAt={renderedAt}
        emptyAction={
          <CreateDocumentDialog
            projectId={projectId}
            projects={projectId ? undefined : activeProjects}
            defaultProjectId={createProject}
          />
        }
      />
    )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <KnowledgeFilters projects={projectId ? undefined : activeProjects} />
        <div className="flex shrink-0 gap-2">
          {filters.tab === "commands" ? (
            <CommandDialogButton options={options} projectId={projectId} />
          ) : (
            <CreateDocumentDialog
              projectId={projectId}
              projects={projectId ? undefined : activeProjects}
              defaultProjectId={createProject}
            />
          )}
        </div>
      </div>
      {results}
    </div>
  )
}
