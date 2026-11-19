import { CircleAlert, CircleCheck } from "lucide-react"

import { cn } from "@/lib/utils"

/** Form-level status line. role=alert so screen readers announce it after submit. */
export function FormMessage({
  status,
  children,
}: {
  status: "error" | "success"
  children: React.ReactNode
}) {
  const Icon = status === "error" ? CircleAlert : CircleCheck
  return (
    <div
      role={status === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
        status === "error"
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-success/30 bg-success/5 text-foreground",
      )}
    >
      <Icon
        className={cn("mt-0.5 size-4 shrink-0", status === "success" && "text-success")}
        aria-hidden
      />
      <span>{children}</span>
    </div>
  )
}

export function toFieldErrors(messages: string[] | undefined) {
  return messages?.map((message) => ({ message }))
}
