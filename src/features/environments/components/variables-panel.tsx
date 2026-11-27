"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertTriangle,
  KeyRound,
  ListPlus,
  Loader2,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { MoreDetails } from "@/components/shared/more-details"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { FormMessage, toFieldErrors } from "@/features/auth/components/form-message"
import { initialFormState, type FormState } from "@/features/projects/schemas"
import { VaultItemValue } from "@/features/vault/components/vault-item-value"
import type { VaultItemOption } from "@/features/vault/queries"
import {
  CONFIGURATION_STATUSES,
  CONFIGURATION_STATUS_META,
  type ConfigurationStatus,
} from "@/lib/constants/domain"
import { formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  addVariable,
  bulkAddVariables,
  deleteVariable,
  setVariableStatus,
  updateVariable,
} from "../actions"
import type { EnvironmentVariableRow, SecretReferenceRow } from "../queries"
import { parseBulkNames, parseVariableName } from "../utils"
import { ConfigurationStatusBadge, VerificationBadge } from "./env-badges"
import { describeReference, SecretReferenceDialog } from "./secret-reference-dialog"

const NONE = "none"
const VAULT = "vault:"
const OTHER = "ref:"

/** The picker's value for a variable: in my vault, in another vault, or not tracked. */
function storedIn(v?: EnvironmentVariableRow) {
  if (v?.account_secret_id) return VAULT + v.account_secret_id
  if (v?.secret_reference_id) return OTHER + v.secret_reference_id
  return NONE
}

/**
 * Configuration-variable registry for one environment (Spec FR-08; Plan P5.5, P5.6, P12.3). Names
 * and flags, plus where each value is kept: in the vault (Show and Copy decrypt it in the
 * browser), in another vault, or not tracked. The form itself never has a value input.
 */
export function VariablesPanel({
  environmentId,
  variables,
  references,
  vaultItems,
  hasVault,
  readOnly,
}: {
  environmentId: string
  variables: EnvironmentVariableRow[]
  references: SecretReferenceRow[]
  vaultItems: VaultItemOption[]
  hasVault: boolean
  readOnly?: boolean
}) {
  const [editing, setEditing] = React.useState<EnvironmentVariableRow | "new" | null>(null)
  const [dialogKey, setDialogKey] = React.useState(0)
  const [bulkOpen, setBulkOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const refById = new Map(references.map((r) => [r.id, r]))
  const itemById = new Map(vaultItems.map((i) => [i.id, i]))

  const open = (v: EnvironmentVariableRow | "new") => {
    setDialogKey((k) => k + 1)
    setEditing(v)
  }

  const attention = variables.filter(
    (v) =>
      v.is_required &&
      (v.configuration_status === "missing" || v.configuration_status === "unknown"),
  ).length

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {variables.length} variable{variables.length === 1 ? "" : "s"}
          {attention ? (
            <span className="ml-2 inline-flex items-center gap-1 text-status-blocked">
              <AlertTriangle className="size-3.5" aria-hidden />
              {attention} required not confirmed
            </span>
          ) : null}
        </p>
        {!readOnly ? (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>
              <ListPlus />
              Add names in bulk
            </Button>
            <Button size="sm" onClick={() => open("new")}>
              <Plus />
              Add variable
            </Button>
          </div>
        ) : null}
      </div>

      {variables.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No variables yet. Register the names this environment needs (e.g. DATABASE_URL) and mark
          whether each is configured. Secret values stay in a vault: link each one to it here.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-48">Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">How</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {variables.map((v) => {
                const ref = v.secret_reference_id ? refById.get(v.secret_reference_id) : undefined
                const item = v.account_secret_id ? itemById.get(v.account_secret_id) : undefined
                const needs =
                  v.is_required &&
                  (v.configuration_status === "missing" || v.configuration_status === "unknown")
                return (
                  <TableRow key={v.id}>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-sm font-medium">{v.name}</span>
                        <span className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                          <span>{v.is_required ? "Required" : "Optional"}</span>
                          {v.is_sensitive ? (
                            <span className="inline-flex items-center gap-1">
                              <ShieldAlert className="size-3" aria-hidden />
                              Sensitive
                            </span>
                          ) : null}
                          {v.is_sensitive && !ref && !item ? (
                            <span className="text-status-in-progress">value location not set</span>
                          ) : null}
                        </span>
                        {/* Where the value is (Plan P12.3), under the name so the table stays narrow. */}
                        {item ? (
                          <div className="pt-1">
                            <VaultItemValue item={item} name={v.name} />
                          </div>
                        ) : ref ? (
                          <span
                            className="inline-flex max-w-md items-center gap-1 text-xs text-muted-foreground"
                            title={describeReference(ref)}
                          >
                            <KeyRound className="size-3.5 shrink-0" aria-hidden />
                            <span className="truncate">{describeReference(ref)}</span>
                          </span>
                        ) : null}
                        {v.notes ? (
                          <span
                            className="max-w-md truncate text-xs text-muted-foreground"
                            title={v.notes}
                          >
                            {v.notes}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {readOnly ? (
                        <ConfigurationStatusBadge status={v.configuration_status} />
                      ) : (
                        <Select
                          value={v.configuration_status}
                          onValueChange={(s) =>
                            startTransition(async () => {
                              const r = await setVariableStatus({
                                environmentId,
                                variableId: v.id,
                                status: s,
                              })
                              if (!r.ok) toast.error(r.error)
                            })
                          }
                          disabled={pending}
                        >
                          <SelectTrigger
                            size="sm"
                            aria-label={`Status of ${v.name}`}
                            className={cn("w-36", needs && "border-status-blocked/50")}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CONFIGURATION_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {CONFIGURATION_STATUS_META[s].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {v.configuration_status === "unknown" ||
                      v.configuration_status === "not_applicable" ? (
                        <span className="text-xs text-muted-foreground">-</span>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          <VerificationBadge method={v.verification_method} />
                          {v.last_verified_at ? (
                            <span className="text-xs text-muted-foreground">
                              {formatRelative(v.last_verified_at)}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {!readOnly ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`Edit ${v.name}`}
                            onClick={() => open(v)}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`Remove ${v.name}`}
                            disabled={pending}
                            onClick={() =>
                              startTransition(async () => {
                                const r = await deleteVariable({ environmentId, variableId: v.id })
                                if (r.ok) toast.success(`Removed ${v.name}`)
                                else toast.error(r.error)
                              })
                            }
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {editing ? (
        <VariableDialog
          key={dialogKey}
          environmentId={environmentId}
          variable={editing === "new" ? undefined : editing}
          references={references}
          vaultItems={vaultItems}
          hasVault={hasVault}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {bulkOpen ? (
        <BulkDialog environmentId={environmentId} onClose={() => setBulkOpen(false)} />
      ) : null}
    </div>
  )
}

function VariableDialog({
  environmentId,
  variable,
  references,
  vaultItems,
  hasVault,
  onClose,
}: {
  environmentId: string
  variable?: EnvironmentVariableRow
  references: SecretReferenceRow[]
  vaultItems: VaultItemOption[]
  hasVault: boolean
  onClose: () => void
}) {
  const [name, setName] = React.useState(variable?.name ?? "")
  const [droppedValue, setDroppedValue] = React.useState(false)
  const [sensitive, setSensitive] = React.useState(variable?.is_sensitive ?? false)
  const [stored, setStored] = React.useState(() => storedIn(variable))
  const [refDialog, setRefDialog] = React.useState(false)
  const [extraRefs, setExtraRefs] = React.useState<SecretReferenceRow[]>([])
  const [state, dispatch, pending] = React.useActionState(
    async (prev: FormState, formData: FormData) => {
      const r = variable
        ? await updateVariable({ environmentId, variableId: variable.id }, prev, formData)
        : await addVariable(environmentId, prev, formData)
      if (r.status === "success") {
        toast.success(r.message ?? "Saved")
        onClose()
      }
      return r
    },
    initialFormState,
  )
  const err = (k: string) => toFieldErrors(state.fieldErrors?.[k])
  // Fold the extras unless one is filled in or has an error (Plan P10.4).
  const hasMore =
    Boolean(variable?.notes || variable?.verification_method === "imported") ||
    Boolean(state.fieldErrors?.notes)
  const allRefs = [
    ...references,
    ...extraRefs.filter((x) => !references.some((r) => r.id === x.id)),
  ]

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form
          className="flex flex-col gap-6"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            const data = new FormData(e.currentTarget)
            React.startTransition(() => dispatch(data))
          }}
        >
          <DialogHeader>
            <DialogTitle>{variable ? `Edit ${variable.name}` : "Add variable"}</DialogTitle>
            <DialogDescription>
              The name, whether it&apos;s set, and where its value is kept. You never type the value
              here.
            </DialogDescription>
          </DialogHeader>
          {state.status === "error" && state.message ? (
            <FormMessage status="error">{state.message}</FormMessage>
          ) : null}
          <FieldGroup>
            <Field data-invalid={Boolean(state.fieldErrors?.name)}>
              <FieldLabel htmlFor="var-name">Name</FieldLabel>
              <Input
                id="var-name"
                name="name"
                value={name}
                onChange={(e) => {
                  // Pasted NAME=value: keep the name, drop the value before it goes anywhere.
                  const parsed = parseVariableName(e.target.value)
                  if (parsed.droppedValue) {
                    setName(parsed.name)
                    setDroppedValue(true)
                  } else {
                    setName(e.target.value)
                  }
                }}
                maxLength={128}
                autoFocus={!variable}
                autoComplete="off"
                spellCheck={false}
                placeholder="DATABASE_URL"
                className="font-mono"
                aria-invalid={Boolean(state.fieldErrors?.name)}
              />
              {droppedValue ? (
                <FieldDescription className="flex items-center gap-1 text-status-in-progress">
                  <AlertTriangle className="size-3.5" aria-hidden />
                  The value after &quot;=&quot; was removed. Only names are stored.
                </FieldDescription>
              ) : null}
              <FieldError errors={err("name")} />
            </Field>

            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="var-required"
                  name="is_required"
                  defaultChecked={variable?.is_required ?? true}
                />
                <Label htmlFor="var-required" className="font-normal">
                  Required
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="var-sensitive"
                  name="is_sensitive"
                  checked={sensitive}
                  onCheckedChange={(v) => setSensitive(v === true)}
                />
                <Label htmlFor="var-sensitive" className="font-normal">
                  Sensitive (a secret)
                </Label>
              </div>
            </div>

            <Field>
              <FieldLabel htmlFor="var-status">Status</FieldLabel>
              <Select
                name="configuration_status"
                defaultValue={variable?.configuration_status ?? "unknown"}
              >
                <SelectTrigger id="var-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONFIGURATION_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {CONFIGURATION_STATUS_META[s as ConfigurationStatus].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              data-invalid={Boolean(
                state.fieldErrors?.secret_reference_id || state.fieldErrors?.account_secret_id,
              )}
            >
              <FieldLabel htmlFor="var-ref">Where the value is stored</FieldLabel>
              {/* One choice feeds two columns: the vault item, or a reference to another vault. */}
              <input
                type="hidden"
                name="account_secret_id"
                value={stored.startsWith(VAULT) ? stored.slice(VAULT.length) : ""}
              />
              <input
                type="hidden"
                name="secret_reference_id"
                value={stored.startsWith(OTHER) ? stored.slice(OTHER.length) : ""}
              />
              <div className="flex gap-2">
                <Select value={stored} onValueChange={setStored}>
                  <SelectTrigger id="var-ref" className="min-w-0 flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not tracked</SelectItem>
                    {vaultItems.length ? (
                      <>
                        <SelectSeparator />
                        <SelectGroup>
                          <SelectLabel>In my vault</SelectLabel>
                          {vaultItems.map((i) => (
                            <SelectItem key={i.id} value={VAULT + i.id}>
                              {i.account} · {i.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </>
                    ) : null}
                    {allRefs.length ? (
                      <>
                        <SelectSeparator />
                        <SelectGroup>
                          <SelectLabel>Other vaults</SelectLabel>
                          {allRefs.map((r) => (
                            <SelectItem key={r.id} value={OTHER + r.id}>
                              {describeReference(r)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </>
                    ) : null}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRefDialog(true)}
                  title="Add a reference to another vault (1Password, Doppler and so on)"
                >
                  <KeyRound />
                  New
                </Button>
              </div>
              {vaultItems.length === 0 ? (
                <FieldDescription>
                  To keep the value in DevWorkspace,{" "}
                  <Link href="/accounts" className="underline underline-offset-4">
                    {hasVault ? "add it to an account" : "set up your vault under Accounts"}
                  </Link>
                  , then pick it here.
                </FieldDescription>
              ) : sensitive && stored === NONE ? (
                <FieldDescription>
                  Pick the vault item that holds this secret, so you can copy it from here.
                </FieldDescription>
              ) : null}
              <FieldError errors={err("secret_reference_id")} />
              <FieldError errors={err("account_secret_id")} />
            </Field>

            <MoreDetails open={hasMore} hint="how it was checked, notes">
              <Field>
                <FieldLabel htmlFor="var-method">Checked how</FieldLabel>
                <Select
                  name="verification_method"
                  defaultValue={
                    variable?.verification_method === "imported" ? "imported" : "manual"
                  }
                >
                  <SelectTrigger id="var-method" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manually confirmed</SelectItem>
                    <SelectItem value="imported">Imported</SelectItem>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  &quot;Integration verified&quot; is only set by a server integration.
                </FieldDescription>
              </Field>
              <Field data-invalid={Boolean(state.fieldErrors?.notes)}>
                <FieldLabel htmlFor="var-notes">Notes</FieldLabel>
                <Textarea
                  id="var-notes"
                  name="notes"
                  defaultValue={variable?.notes ?? ""}
                  maxLength={2000}
                  rows={2}
                  placeholder="Format, who issues it, rotation…"
                  aria-invalid={Boolean(state.fieldErrors?.notes)}
                />
                <FieldError errors={err("notes")} />
              </Field>
            </MoreDetails>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {variable ? "Save variable" : "Add variable"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      {refDialog ? (
        <SecretReferenceDialog
          open
          onOpenChange={setRefDialog}
          defaultKeyName={name}
          onSaved={(id) => {
            if (!id) return
            setExtraRefs((xs) => [
              ...xs,
              {
                id,
                provider: "New reference",
                vault_project_or_workspace: null,
                vault_path_or_item_id: "",
                key_name: name || null,
                vault_url: null,
              },
            ])
            setStored(OTHER + id)
          }}
        />
      ) : null}
    </Dialog>
  )
}

/** Names-only bulk add (Plan P5.6): values are dropped in the browser before anything is sent. */
function BulkDialog({ environmentId, onClose }: { environmentId: string; onClose: () => void }) {
  const [raw, setRaw] = React.useState("")
  const parsed = parseBulkNames(raw)
  const [state, dispatch, pending] = React.useActionState(
    async (prev: FormState, formData: FormData) => {
      const r = await bulkAddVariables(environmentId, prev, formData)
      if (r.status === "success") {
        toast.success(r.message ?? "Added")
        onClose()
      }
      return r
    },
    initialFormState,
  )

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form
          className="flex flex-col gap-6"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            // Only the parsed names are submitted; the textarea (which may hold values) is not.
            const data = new FormData()
            data.set("names", parsed.names.join("\n"))
            if (new FormData(e.currentTarget).get("bulk-sensitive") === "on") {
              data.set("is_sensitive", "on")
            }
            React.startTransition(() => dispatch(data))
          }}
        >
          <DialogHeader>
            <DialogTitle>Add variable names</DialogTitle>
            <DialogDescription>
              One per line. You can paste a .env file: values, comments and blank lines are
              discarded here in your browser and never sent.
            </DialogDescription>
          </DialogHeader>
          {state.status === "error" && state.message ? (
            <FormMessage status="error">{state.message}</FormMessage>
          ) : null}
          <Field data-invalid={Boolean(state.fieldErrors?.names || parsed.invalid.length)}>
            <FieldLabel htmlFor="bulk-names">Names</FieldLabel>
            <Textarea
              id="bulk-names"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={6}
              autoFocus
              spellCheck={false}
              className="font-mono text-sm"
              placeholder={"DATABASE_URL\nREDIS_URL\nNEXT_PUBLIC_SITE_URL"}
            />
            {parsed.droppedValues ? (
              <FieldDescription className="flex items-center gap-1 text-status-in-progress">
                <AlertTriangle className="size-3.5" aria-hidden />
                {parsed.droppedValues} value{parsed.droppedValues === 1 ? "" : "s"} will be
                discarded.
              </FieldDescription>
            ) : null}
            {parsed.invalid.length ? (
              <FieldError
                errors={[{ message: `Not valid names: ${parsed.invalid.slice(0, 5).join(", ")}` }]}
              />
            ) : null}
            <FieldError errors={toFieldErrors(state.fieldErrors?.names)} />
          </Field>
          <div className="flex items-center gap-2">
            <Checkbox id="bulk-sensitive" name="bulk-sensitive" />
            <Label htmlFor="bulk-sensitive" className="font-normal">
              Mark all as sensitive
            </Label>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Will be saved ({parsed.names.length})
            </p>
            {parsed.names.length ? (
              <ul className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                {parsed.names.map((n) => (
                  <li key={n} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {n}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing yet.</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending || parsed.names.length === 0 || parsed.invalid.length > 0}
            >
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Add {parsed.names.length || ""} name{parsed.names.length === 1 ? "" : "s"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
