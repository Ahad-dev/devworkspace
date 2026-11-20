import { requestTime } from "@/lib/request-time"
import { getActiveSession } from "../queries"
import { ActiveSessionWidget } from "./active-session-widget"

/** Header slot: renders only while a session is running. Wrapped in <Suspense> by the header. */
export async function ActiveSessionServer() {
  const session = await getActiveSession()
  if (!session) return null
  const renderedAt = await requestTime()
  return (
    <ActiveSessionWidget
      renderedAt={renderedAt}
      session={{
        id: session.id,
        closedSeconds: session.closedSeconds,
        openSegmentStartedAt: session.openSegmentStartedAt,
        task: session.task
          ? { id: session.task.id, title: session.task.title, nextAction: session.task.nextAction }
          : null,
        projectName: session.project.name,
      }}
    />
  )
}
