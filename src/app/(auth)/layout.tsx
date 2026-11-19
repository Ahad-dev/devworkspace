import { SquareTerminal } from "lucide-react"

/** Focused single-column layout for sign-in and password flows (Spec §6.1). */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <SquareTerminal className="size-5" aria-hidden />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-base font-semibold">DevWorkspace</p>
            <p className="text-sm text-muted-foreground">
              Projects, tasks, handoffs and environments in one place.
            </p>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-6 text-card-foreground">{children}</div>
      </div>
    </div>
  )
}
