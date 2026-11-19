# DevWorkspace — Working Implementation Plan

**Source of truth:** `docs/DevWorkspace_Full_Product_and_Implementation_Specification.md` (the "Spec").
The Spec says _what_. This plan says _how and in what order_. If they conflict, the Spec wins unless
the Decision Log below records an override.
**Created:** 2026-11-19 · **Status:** Phase 1 in progress. Done: P1.1–P1.9, P1.11, P1.12. Left: P1.10 (test harness). Checkpoint P1 also needs an end-to-end password-reset email test.

## 0. How this plan is used

- Work one phase at a time. Every step has an ID (e.g. `P3.4`), cites Spec requirement IDs, and lists the
  migrations, files and tests it adds.
- Tick `[x]` when a step meets the Definition of Done (§8). Record any deviation in the Decision Log (§10).
- A phase is closed only when its **Checkpoint** passes.
- Commits happen at step-group boundaries, only when the user asks. CI must be green before a phase closes.
- Steps marked **(U)** are user actions I cannot do: account creation, passwords, tokens, dashboards.

## 1. Locked stack & versions (checked on npm 2026-11-19; pin exact versions at install)

| Concern           | Choice                                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework         | next 16.4.6 (App Router, `src/`, Turbopack), react 19.3.1, TypeScript strict + `noUncheckedIndexedAccess`                                       |
| UI                | tailwindcss 4.3.5, shadcn 4.23.0 (Radix), next-themes (light/dark), lucide-react, sonner toasts                                                 |
| Forms/validation  | react-hook-form 7.92.0, zod 4.6.7, @hookform/resolvers (latest compatible with zod 4)                                                           |
| Data              | @supabase/supabase-js 2.119.2, @supabase/ssr 0.12.7; @tanstack/react-query 5.108.0 **only** where client caching helps (board, command palette) |
| Supabase CLI      | `supabase` 3.2.0 as a devDependency, run via `pnpm exec supabase`                                                                               |
| Board DnD         | @dnd-kit/core 6.3.1 (+ sortable, keyboard sensor)                                                                                               |
| Markdown          | react-markdown + remark-gfm + rehype-sanitize (no raw HTML, no rehype-raw)                                                                      |
| Dates             | date-fns + @date-fns/tz (UTC stored, profile timezone displayed)                                                                                |
| Tests             | vitest 5.1.1 (unit + integration projects), @playwright/test 1.65.1 (+ @axe-core/playwright)                                                    |
| Lint/format       | ESLint (Next config), Prettier + prettier-plugin-tailwindcss                                                                                    |
| CI                | GitHub Actions on the private repo `devworkspace`                                                                                               |
| Hosting (Phase 8) | Vercel, linked to the GitHub repo                                                                                                               |

Verify at implementation time, because these APIs drift. Next 16 renamed `middleware.ts` to **`proxy.ts`**. Supabase SSR
guidance may prefer `auth.getClaims()` over `getUser()` for server checks. Supabase keys are publishable/secret
(`sb_publishable_…` / `sb_secret_…`).

## 2. Environment model (user decision: hosted dev backend)

| DevWorkspace env | Frontend                     | Backend                                        |
| ---------------- | ---------------------------- | ---------------------------------------------- |
| Local dev        | `pnpm dev` on localhost:3000 | **Hosted Supabase project `devworkspace-dev`** |
| Preview          | Vercel preview (Phase 8)     | `devworkspace-dev`                             |
| Production       | Vercel production (Phase 8)  | Separate hosted project `devworkspace-prod`    |

Consequences (they replace the Spec's local-Docker steps in §10.2):

- Migrations are written in `supabase/migrations/` and applied with `pnpm db:push`, which wraps `supabase db push` to the linked dev project.
- No `supabase start`. `supabase db reset --linked` wipes the dev DB, so I run it only with the user's explicit OK, and never against prod.
- Types: `pnpm db:types` → `supabase gen types typescript --linked > src/types/database.types.ts`, run after every migration.
- DB/RLS tests run as a **Vitest integration suite against the dev project**. Each run creates ephemeral users through the
  admin API with the dev project's secret key (gitignored `.env.test.local`), then deletes them, which cascades their data.
  The user's real owner account is never touched by tests.
- Free-tier projects pause after inactivity. If requests time out, the user resumes the project from the dashboard.
- Docker local stack can be adopted later without changing migrations.

## 3. User actions (U)

| ID  | When             | Action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| U1  | P1.4             | Create the Supabase project `devworkspace-dev` (pick a nearby region) and store its DB password in your password manager.                                                                                                                                                                                                                                                                                                                                                                                                |
| U2  | P1.4             | Send me the Project URL and **publishable** key (they are public values), or paste them into `.env.local` yourself.                                                                                                                                                                                                                                                                                                                                                                                                      |
| U3  | P1.4             | Done. The CLI is logged in with a scoped personal access token from the owner account (`devworkspace-dev` only, Database + Migrations Read-write) and linked. Database commands use `SUPABASE_DB_PASSWORD` from the gitignored `.env.supabase.local` (letters and digits only: special characters broke CLI authentication).                                                                                                                                                                                             |
| U4  | P1.6             | Dashboard → Authentication: turn **off** “Allow new users to sign up”. URL Configuration: Site URL `http://localhost:3000`, Redirect URLs `http://localhost:3000/**` (a reset link whose redirect isn't on this list falls back to the Site URL and loses its code). Users → Add user: your owner account with your own password, ideally the email of your Supabase account, because the built-in mailer only delivers to team members. No email template change for now: editing templates needs custom SMTP (see U7). |
| U5  | P1.10            | Paste the dev project's **secret** key into `.env.test.local` as `SUPABASE_SECRET_KEY`. Dev project only; never commit it.                                                                                                                                                                                                                                                                                                                                                                                               |
| U6  | P1.11 (optional) | Add GitHub repo secrets so CI can run integration/e2e tests against dev.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| U7  | Phase 8          | Create `devworkspace-prod`, a Vercel account/project and a domain. Set up **custom SMTP**; the built-in mailer is rate-limited, only sends to team members, and doesn't allow template edits. Then change Email Templates → Reset Password to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/update-password`, so reset links work in any browser. Set the production env vars in Vercel.                                                                                                  |

## 4. Repository layout (Spec §11, with these deviations)

- `docs/` holds the Spec, this plan, `SECURITY.md` and `OPERATIONS.md`.
- `src/proxy.ts` (Next 16) calls `src/lib/supabase/proxy.ts` (session refresh + redirect). The Spec's `middleware.ts` maps to this.
- DB tests live in `tests/integration/` (Vitest against hosted dev). There is no `supabase/tests/` pgTAP for now.
- `scripts/seed-dev.ts` creates realistic sample data **for a test user only**, used for perf checks.
- `src/lib/security/secret-guard.ts` is a shared credential detector (see §5).
- Feature folders follow `src/features/<feature>/{components,actions,queries,schemas,utils}` (Spec §11).

## 5. Cross-cutting conventions (decide once, apply everywhere)

**Schema**

- Every user-owned table has `id uuid pk default gen_random_uuid()`, `owner_id uuid not null default auth.uid() references profiles(id) on delete cascade`,
  `created_at`/`updated_at timestamptz default now()`, and the shared `set_updated_at()` trigger.
- Use Postgres **enums** for fixed lists (statuses, priorities, types, categories), so generated TS types are unions. Add values with `alter type … add value`.
- **Composite FKs enforce same-owner and same-project integrity in the DB** (Spec §8.2 "a simple FK is not enough"):
  - Parents declare `unique (id, owner_id)` and, where children need it, `unique (id, project_id)`.
  - Children use `foreign key (project_id, owner_id) references projects(id, owner_id)` and
    `foreign key (repository_id, project_id) references repositories(id, project_id)`. Nullable optional links are skipped by MATCH SIMPLE.
  - For optional links whose parent can be deleted, use `on delete set null (repository_id)`, the column-list form (PG15+), so `owner_id`/`project_id` are not nulled.
- Deletion policy: project delete is a hard delete that cascades **explicitly** on each child FK, behind a confirmation dialog that shows child counts.
  Tasks with children use `restrict`. Archive is the default UX everywhere.
- Text limits: titles 1–300 chars, long text up to 100k. URL columns get a check `^https?://` plus a **no-credentials check** (`!~ '://[^/@]+:[^/@]+@'`).

**Security**

- RLS on every table, with separate select/insert/update/delete policies `to authenticated` using `(select auth.uid()) = owner_id`
  (with check on insert/update). Revoke table privileges from `anon`.
- Views are created `with (security_invoker = true)`, because a plain view bypasses RLS.
- Privileged helpers (activity writer, new-user bootstrap) are `security definer` in a non-exposed `private` schema with `set search_path = ''`.
- RPC functions are `security invoker` and rely on RLS plus `auth.uid()`. They never accept `owner_id` from the client.
- `secret-guard.ts` flags credential-bearing URLs, PEM blocks, JWT shapes, known key prefixes (`sk_live_`, `ghp_`, `AKIA`, `xox`, `sb_secret_`…)
  and long high-entropy tokens. It rejects input in hostname/endpoint/URL fields and warns in notes and command text.
- Markdown is rendered only through the sanitized pipeline. External links get `target="_blank" rel="noopener noreferrer"`, http/https only.
- The secret key is imported only from `server-only` modules (account deletion, test helpers) and is never bundled to the browser.

**App code**

- Reads go through Server Components calling `features/*/queries` (server-only, select only needed columns).
- Writes go through Server Actions in `features/*/actions`. Each action runs a Zod parse, checks the user, runs the Supabase call or RPC, then `revalidatePath`, and
  returns `ActionResult<T> = {ok:true,data} | {ok:false,error,fieldErrors?}`. The same Zod schema drives the RHF form.
- Filters live in URL search params, which makes them server-rendered, shareable and clearable.
- **Cache Components is on** (Next 16.4 default, with `partialPrefetching`). Anything that reads the session or cookies (the Supabase server
  client, the current user, user data) must render inside a `<Suspense>` boundary. Layouts must never `await` the session at the top level;
  push the dynamic read into a child component. Don't put user data in plain `use cache` (it can't read cookies, and RLS needs the user's JWT).
  Read `node_modules/next/dist/docs/` before relying on remembered Next.js APIs: `error.tsx` gets `retry`, and `proxy.ts` replaces `middleware.ts`.
- **Activity** is written by DB triggers that call `private.record_activity(...)`, so it is atomic and can't be forgotten. Metadata is limited to
  ids, names and old/new enum values, never free text that could hold secrets. Summaries are rendered from `src/features/activity/registry.ts`.
- UI follows the Spec's rules: tables/lists over cards, status/priority/env-type tokens defined in `src/lib/constants` with light and dark values,
  a visible production indicator, confirmed destructive actions, and empty states with a next action.

## 6. Phases

### Phase 1 — Foundation, auth, shell (FR-01; Spec §10, §12-P1)

- [x] **P1.1 Repo bootstrap.** git init, docs/, this plan, CLAUDE.md, .gitignore, private GitHub repo `devworkspace`.
- [x] **P1.2 Scaffold.** `pnpm create next-app@16.4.6` (TS, Tailwind, ESLint, App Router, `src/`, `@/*`). If it refuses the non-empty folder, scaffold
      in a temp dir and move the files in. Enable strict TS, add Prettier, and add scripts: `dev build start lint typecheck format test test:int test:e2e db:new db:push db:types`.
- [x] **P1.3 UI foundation.** `shadcn init` and core components (button, input, textarea, label, select, checkbox, dialog, alert-dialog, sheet,
      dropdown-menu, popover, command, tabs, table, badge, tooltip, skeleton, separator, breadcrumb, sidebar, avatar, calendar, form, sonner).
      Add next-themes, the status/priority/env tokens, and a temporary static shell so the layout can be reviewed.
- [x] **P1.4 Supabase wiring.** (U1–U3) `pnpm add -D supabase@3.2.0`, `supabase init`, link. Write `.env.example`
      (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) and `.env.local`.
- [x] **P1.5 Clients + route protection.** `src/lib/supabase/{client,server,proxy}.ts` (per-request server client, async `cookies()`) and
      `src/proxy.ts`. Unauthenticated users are redirected to `/login`. Public routes: `/login`, `/reset-password`, `/auth/*`.
- [x] **P1.6 Migration M01 `foundation`.** `private` schema, `set_updated_at()`, `profiles` (display_name, timezone default 'UTC', preferences jsonb
      object, max 8 KB), and an `auth.users` insert trigger that creates the profile. RLS: select/update own only. Revoke anon. (U4)
- [x] **P1.7 Auth UI.** `(auth)/login` (generic error), `(auth)/reset-password` (always shows the same success message), a `/auth/confirm` route
      handler (verifyOtp token_hash), `(auth)/update-password`, and a sign-out action. No registration page.
- [x] **P1.8 App shell.** `(workspace)/layout.tsx`: collapsible sidebar with the Spec §3.1 groups; header with breadcrumbs, search trigger, quick-create
      and profile menu (theme, sign out); `loading`/`error`/`not-found`. `/onboarding` asks for name and timezone (Intl-detected) when the profile is empty.
- [x] **P1.9 Settings (partial).** Profile, timezone and appearance.
- [ ] **P1.10 Test harness.** (U5) Vitest config with `unit` and `integration` projects. `tests/integration/helpers.ts` provides `adminClient()`,
      `createTestUser()`, `clientFor(user)` and `cleanup()`. First RLS test: A reads/updates own profile; B and anon cannot read A's profile. Playwright config
      with global setup that creates an e2e user. E2E: logged-out redirect, then sign-in, then the shell.
- [x] **P1.11 CI.** `.github/workflows/ci.yml` runs pnpm install --frozen-lockfile, lint, typecheck, unit tests and build. Integration/e2e jobs run only if secrets exist. (U6)
- [x] **P1.12 Docs.** README setup, `docs/SECURITY.md` (secret boundary, Spec §9.3).

**Checkpoint P1:** the owner signs in on localhost and sees the empty shell; logged-out access redirects; the reset email flow
completes; integration tests prove user B and anon cannot read A's profile; CI is green.

### Phase 2 — Projects, repositories, technologies (FR-03, FR-04, FR-05, FR-13 partial)

- [ ] **P2.1 M02 `activity`.** Table `activity_events` (event_type enum registry, summary, safe metadata jsonb, project_id, task_id; the FK to tasks is added in M06),
      RLS **select-only**, and the writer `private.record_activity()`.
- [ ] **P2.2 M03 `projects`.** Enums project_type/project_status/priority_level. Check `(status='archived') = (archived_at is not null)`. `unique(id, owner_id)`,
      `unique(owner_id, slug)`. Index `(owner_id, status, updated_at desc)`. RLS. Triggers for updated_at and activity (created/updated/archived/restored).
      Routes use the project uuid; slug is optional.
- [ ] **P2.3 M04 `repositories`.** Provider/purpose enums. FK `(project_id, owner_id)` cascade. `unique(id, project_id)`. URL checks. RLS. Activity.
- [ ] **P2.4 M05 `project_technologies`.** Category enum. FK to project, and FK `(repository_id, project_id)` with set null. Unique per project+name+repo. RLS.
- [ ] **P2.5 `project_summaries` view** (security_invoker): repo/tech counts now. It gets redefined to add task/env counts in later phases.
- [ ] **P2.6 Projects list `/projects`.** Search, status/type filters, sort (updated/priority/name), active/archived toggle, compact table with counts.
- [ ] **P2.7 Create/edit project.** Dialog for name and type (only these are required), plus a full edit page. Archive/restore, and delete with a child-count confirmation.
- [ ] **P2.8 Project workspace `/projects/[projectId]/…`** with the tab layout (Overview, Tasks, Repositories, Environments, Services, Documentation, Activity).
      Tabs not built yet show an empty state. Overview: description (markdown), status, dates, links, technology chips (inline add/edit), repo summary, recent activity.
- [ ] **P2.9 Repositories tab.** Table with add/edit/delete and safe external links.
- [ ] **P2.10 Activity tab.** Paginated project activity list.
- [ ] **P2.11 Tests.** Integration: B can't read or insert into A's projects; a repo insert pointing to A's project fails (composite FK); a technology→repo link
      across projects fails; the archive invariant holds; cascade delete removes children; activity rows are written. Unit: schemas, URL/credential checks,
      secret-guard. E2E: create a project, add 2 repos, add technologies, archive, restore.

**Checkpoint P2:** all real active projects, repositories and stacks can be registered (Spec Phase 2 deliverable).

### Phase 3 — Native task management (FR-06, FR-13)

- [ ] **P3.1 M06 `tasks`.** task_status enum, priority reuse. FKs: `(project_id, owner_id)`, `(repository_id, project_id)` set null,
      `(parent_task_id, project_id)` restrict. Checks: blocked ⇒ non-empty blocker_details; done ⇔ completed_at set. A `before` trigger sets/clears completed_at
      and rejects parent cycles (recursive CTE). An `after` trigger writes activity (created, status/priority changed, completed, reopened, archived).
      Also add the `task_links` table (label + url) and the activity_events.task_id FK (on delete set null). Indexes per Spec §8.4.
- [ ] **P3.2 M07 labels.** `task_labels` (unique owner+lower(name), color from the token list) and `task_label_links` (owner_id + composite FKs to task and label).
- [ ] **P3.3 M08 `task_comments`.** Composite FK to the task. Activity "comment added".
- [ ] **P3.4 M09 `task_dependencies`.** Carries project_id; both task FKs go through `(…, project_id)`, so the same project is guaranteed. A check prevents self-dependency.
      A `before insert` trigger rejects cycles.
- [ ] **P3.5 M10 RPC `move_task(task_id, status, sort_order, blocker_details)`** for board moves (one round trip; triggers do the rest).
- [ ] **P3.6 Task queries.** Combined filters: project, status[], priority[], due range, repository, label, plus the flags blocked, overdue (`due_at < now()` and not done)
      and missing-next-action (in_progress with an empty next_action). Range pagination at 50 rows.
- [ ] **P3.7 `/my-work`.** Views All / Inbox / Upcoming / Blocked / Completed; List|Board switch; filter bar with clear-all. List columns follow Spec §6.5.
- [ ] **P3.8 Board.** dnd-kit columns per status. Optimistic move with rollback and a toast on error. Keyboard alternative: the keyboard sensor plus a status menu on each card.
      Dropping into Blocked opens the blocker-details dialog.
- [ ] **P3.9 Create flows.** Quick capture (title + project → **Inbox**) from the header and project page. The full form defaults to **Ready**.
- [ ] **P3.10 Task detail `/tasks/[taskId]`** (plus a sheet from lists). Header (title/status/priority); main area with description, subtasks, dependencies
      (picker limited to the same project, friendly cycle error) and comments; right panel with repo, due, labels, links and metadata; a prominent **Next action** card;
      blocker; activity timeline; continuity panel placeholder until Phase 4.
- [ ] **P3.11 Project Tasks tab.** Reuses the list and board with the project filter fixed. The summary view gains task counts and progress.
- [ ] **P3.12 Tests.** Integration: dependency cycle A→B→C→A rejected; self and cross-project dependencies rejected; cross-project repo/parent rejected; parent cycle
      rejected; blocked without details rejected; done sets completed_at and reopen clears it; cross-owner label link rejected; B sees none of A's tasks, comments or labels;
      activity metadata holds no free text. Unit: status helpers, priority sort, overdue in the user's timezone, filter-param parsing. E2E: create a task, move it through
      every status on the board and in the list, blocked requires details.

**Checkpoint P3:** all development tasks can be managed from one native queue (Spec Phase 3 deliverable).

### Phase 4 — Work sessions & handoffs (FR-07)

- [ ] **P4.1 M11 sessions.** session_status enum. `work_sessions` with FKs to project/task/repository through `(…, project_id)`; environment_id gets its FK in M12.
      MVP RPCs require a task (Spec open decision 3). A partial unique index on `(owner_id) where status='active'`. `work_session_segments` with a partial unique
      index for one open segment per session and a check that end > start. `work_handoffs` is **append-only**: RLS select + insert only.
- [ ] **P4.2 RPCs** (security invoker, `pg_advisory_xact_lock` per user to serialize): `start_work_session(task_id, repository_id?, branch?, environment_id?, move_task_to_in_progress bool)`
      raises a coded error `active_session_exists` that returns the active id. Also `pause_work_session(id, ended_at?)` (ended_at bounded to [segment start, now], for stale recovery),
      `resume_work_session(id)`, `save_handoff(session_id, fields…, update_task_next_action bool)` and `complete_work_session(id, handoff…, update_task_next_action bool)`, which is atomic.
      Every RPC emits activity.
- [ ] **P4.3 Duration view** (security_invoker): sums `coalesce(segment_ended_at, now()) - segment_started_at`.
- [ ] **P4.4 Active-session widget** in the header. Server-fetched, and the displayed elapsed time is derived from the persisted segment start (refreshed on focus). Optional
      Realtime on `work_sessions` for this owner, cleaned up on unmount.
- [ ] **P4.5 Task controls.** Start / Resume work, Pause, Complete, Save progress. If another session is active, a dialog offers to pause or finish it first.
- [ ] **P4.6 Handoff dialog.** Fields from Spec §7 FR-07, with "update task next action" on by default. It is prompted on pause and complete. A missing next action is allowed but flagged.
- [ ] **P4.7 Continuity panel** on the task (latest handoff first, then session history). `/sessions` page lists active, paused and history. **Stale** means an active session
      whose segment is older than 12 h; it gets a banner that offers to close at now or at a chosen time.
- [ ] **P4.8 Tests.** Integration: two concurrent `start` calls (Promise.all) leave exactly one active; pause and resume produce correct segments and totals; paused time is excluded;
      a failing handoff leaves the session uncompleted (atomic); handoffs can't be updated or deleted; B can't pause A's session. Unit: duration math. E2E: start, reload, still running,
      pause with handoff, the task shows the handoff, resume.

**Checkpoint P4:** sessions and handoffs survive refreshes and other devices (Spec Phase 4 deliverable).

### Phase 5 — Environments, services, configuration metadata (FR-08, FR-09)

- [ ] **P5.1 M12 `environments`.** environment_type/status enums; runtime_versions must be a jsonb object of strings; URL credential checks; `unique(id, project_id)`;
      the `work_sessions.environment_id` FK is added; activity.
- [ ] **P5.2 M13 services.** `project_services` (category enum) and `service_instances`. **service_instances gets a project_id column** so both FKs `(project_service_id, project_id)`
      and `(environment_id, project_id)` enforce the same project. Status enum; credential check on endpoint_hostname.
- [ ] **P5.3 M14 config metadata.** `secret_references` (locator only) and `environment_variables`. Name check `^[A-Za-z_][A-Za-z0-9_]*$`; `unique(environment_id, name)`;
      **no value column**; FK `(secret_reference_id, owner_id)` with set null (column list). A trigger lets authenticated users set `verification_method` only to manual or imported;
      `integration` is reserved for future server integrations. Activity covers metadata changes and refs added or removed, names only.
- [ ] **P5.4 Environments tab + global `/environments`.** Type badges and a strong production indicator/banner. Create, edit, archive. Deleting a **production** environment requires
      typing its name. "Needs review" means status needs_review or last_reviewed_at older than 90 days.
- [ ] **P5.5 Environment detail.** URLs, host/provider/runtime, service instances, the variables table (required, sensitive, status with a method badge **Manually confirmed / Imported /
      Integration verified**, last verified, secret ref), a "Mark reviewed" action, and setup notes.
- [ ] **P5.6 Variable and secret-ref forms.** Name and flags only, no value input. If `NAME=value` is pasted into the name field, the value is stripped client-side with a warning.
      Optional: a names-only bulk add where values are discarded before submit and a preview shows exactly what will be saved. Secret-ref editor: provider (Infisical/Doppler/1Password/other),
      workspace, path/item, key and vault URL.
- [ ] **P5.7 Compare `/environments/compare?project=…&envs=…`.** A pure TS `buildComparison()` produces the matrix: presence per environment, required missing/unknown highlighted, sensitivity,
      ref present, method and time. It never shows values.
- [ ] **P5.8 Services tab + global `/services`.** Service definitions with their instances per environment, and cross-project search.
- [ ] **P5.9 Tests.** Integration: an information_schema assertion that environment_variables has no value-like column; credential URLs rejected by the DB; a cross-project service instance
      rejected; `integration` verification rejected for a normal user; B denied. Unit: buildComparison, secret-guard, env-name parsing. E2E: local + production environments, variables,
      secret ref, compare.

**Checkpoint P5:** local, dev, staging and production environments can be documented and compared without storing credentials.

### Phase 6 — Knowledge base, commands, attachments (FR-10, FR-11)

- [ ] **P6.1 M15 `documents`.** doc_category enum; optional project (global when null) plus optional repo/env. Generated `search_vector` (title A, summary B, content C) with a GIN index.
      archived_at; activity. Also `task_document_links` (owner_id + composite FKs).
- [ ] **P6.2 M16 attachments.** `document_attachments` metadata and a **private** bucket `attachments` (10 MB limit; allowlist pdf/png/jpeg/webp/gif/txt/md/csv/json; **no svg/html**).
      Path `{owner_id}/{document_id}/{uuid}-{sanitized}`. storage.objects select/insert/delete policies on `(storage.foldername(name))[1] = auth.uid()::text`.
      Upload: an action validates the file, creates the row, then the client uploads to the generated path. Download: an action verifies ownership and returns a signed URL valid
      for 60 s with `download`.
- [ ] **P6.3 M17 `command_snippets`.** shell/os/category enums; optional project/repo/env through composite FKs; search_vector.
- [ ] **P6.4 `/knowledge`** with Documents and Commands tabs, filtered by project/category, plus search. The project Documentation tab shows the same data scoped to the project.
- [ ] **P6.5 Document editor.** Title, category and project; markdown editor with preview (split/tabs); explicit save plus Ctrl/Cmd+S; a dirty indicator and a `beforeunload` guard;
      attachments panel; linked tasks; updated timestamp.
- [ ] **P6.6 Commands.** Rows with shell/OS/env badges (production highlighted), a destructive warning, and a copy button. secret-guard warns on literal secrets and suggests `$VAR`
      placeholders. A destructive heuristic (`rm -rf`, `DROP`, `TRUNCATE`, `db reset`, `--force`, …) suggests setting the flag.
- [ ] **P6.7 Tests.** Integration: B can't read, upload into or sign A's objects; a disallowed MIME type is rejected; FTS finds titles and body. Unit: markdown sanitization (`<script>`,
      `javascript:`), filename sanitizer, destructive heuristic. E2E: doc, upload, download; command, copy.

**Checkpoint P6:** setup guides, runbooks, commands and notes live next to their project.

### Phase 7 — Dashboard, global search, activity completion (FR-02, FR-12, FR-13)

- [ ] **P7.1 `dashboard_summary()` RPC** returns counts for inbox, ready, in_progress, blocked, review, overdue, missing next action and environments needing review.
      Plus queries for the work queue (ready + in_progress, ordered by priority then due), upcoming (next 7 days in the user's timezone), recent activity (20),
      and project progress = done ÷ non-archived tasks, or "No tasks".
- [ ] **P7.2 Dashboard page** following Spec §6.2: current focus (active or most recent paused session with resume), work queue, attention required, project overview, upcoming deadlines,
      recent activity, quick actions.
- [ ] **P7.3 Quick-create** (header + dashboard): project, task, session, document, environment.
- [ ] **P7.4 `global_search(q, limit)` RPC.** A union across projects, tasks, repositories, environments, services, documents, commands and env-var **names**.
      Uses `websearch_to_tsquery` plus an `ilike` fallback for identifiers like `DATABASE_URL`. Returns type, id, project context and a `ts_headline` excerpt.
- [ ] **P7.5 Command palette** on Ctrl/Cmd+K (shadcn Command) with a 200 ms debounce, grouped results and keyboard navigation. Also a `/search?q=` page.
- [ ] **P7.6 Activity completion.** Global feed, task timelines, and registry summaries for every event type.
- [ ] **P7.7 Performance.** `scripts/seed-dev.ts` loads sample data for a test user. Run EXPLAIN on the dashboard, search and task-list queries, and add indexes based on the plans.
- [ ] **P7.8 Tests.** Integration: dashboard counts match the fixture; search never returns B's rows. E2E: searching "Redis" opens the environment or service with project context.

**Checkpoint P7:** the dashboard is the daily entry point, and search finds context across projects.

### Phase 8 — Hardening, export, production release (FR-14; Spec §9, §10, §12-P8, §18)

- [ ] **P8.1 Settings completion.** Default task view; security ("sign out other sessions"); **export**: JSON of all owned rows with `schema_version` plus a ZIP of markdown documents
      and attachments, with a note that external vault secrets are not included; **account deletion**: re-enter the password, then a server-only action removes storage objects
      and calls `admin.deleteUser` (DB cascade).
- [ ] **P8.2 RLS audit.** Run `supabase db lint --linked` and the Security Advisor. A **table-driven cross-user test covering every table** (select/insert/update/delete as B) runs with every test pass.
- [ ] **P8.3 Security headers** in `next.config.ts`: CSP, frame-ancestors none, Referrer-Policy, Permissions-Policy, HSTS in prod. Logging review: no tokens, secrets or credential URLs.
- [ ] **P8.4 Accessibility & responsive pass.** axe checks in Playwright, keyboard-only walkthrough, mobile handoff/task-update flows.
- [ ] **P8.5 Production.** (U7) Link the prod project and run `db push` **only after the user reviews the migration list**. Auth settings: sign-ups off, custom SMTP, prod redirect URLs; owner user.
      Vercel project with env vars, domain and HTTPS.
- [ ] **P8.6 `docs/OPERATIONS.md`.** Backup/PITR options for the chosen plan, `supabase db dump` logical exports, a **restore drill into the dev project**, and what to do if the project is lost.
- [ ] **P8.7 Production smoke test,** then tick every item of the Spec §18 release checklist.

## 7. Test coverage map (Spec §13 → where it is covered)

| Spec test                                       | Step                                                                              |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| Migrations apply cleanly                        | Every `db:push`; P8.2 rebuilds the dev DB from zero (with user OK)                |
| Owner allowed / second user denied              | P1.10, every phase's tests, P8.2 table-driven                                     |
| Child-ID cross-owner access                     | P2.11, P3.12, P5.9                                                                |
| Repo ∈ project; env/service ∈ project           | P2.11, P3.12, P5.9                                                                |
| Dependency cycles                               | P3.12                                                                             |
| One active session; segments; atomic completion | P4.8                                                                              |
| Activity has no secrets                         | P3.12, P5.9                                                                       |
| Private, owner-scoped storage                   | P6.7                                                                              |
| E2E journeys 1–12 (Spec §13.3)                  | P2.11 (1–2), P3.12 (3), P4.8 (4–5), P5.9 (6–8), P6.7 (9–10), P7.8 (11), P8.2 (12) |

## 8. Definition of Done (per step; Spec §19)

The workflow works end to end. Input is validated by Zod at the action boundary and by DB constraints. RLS is tested for owner allowed / other denied.
Loading, empty, success and error states exist. Archive/delete behaviour is correct. Activity is emitted where the Spec requires it. The UI is keyboard-usable.
Tests are added. No secrets appear in logs, URLs or browser state. `database.types.ts` is regenerated. The checkbox is ticked here.

## 9. Open-decision defaults (Spec §17.3), revisit at the noted point

1. Task default status: quick capture → Inbox; full form → Ready.
2. Progress = done ÷ all non-archived tasks, inbox included. Revisit after the first dashboard use (P7).
3. Sessions require a task in MVP. The column stays nullable for later project-level sessions.
4. Vault provider: none selected. Free-text provider with suggestions.
5. Hosting plan/domain: decided at P8.5.
6. Search includes document bodies (tsvector). Revisit if it gets slow.

## 10. Decision log

| Date       | Decision                                                                                                                                                                                                                                                         | Why                                                                                                                                                                              |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-19 | Hosted Supabase dev project instead of a local Docker stack                                                                                                                                                                                                      | User choice; Docker not running. Tests use ephemeral users on dev.                                                                                                               |
| 2026-11-19 | pnpm; repo root = DevWorkspace folder; spec moved to docs/                                                                                                                                                                                                       | User choice                                                                                                                                                                      |
| 2026-11-19 | Private GitHub repo `devworkspace` + GitHub Actions from Phase 1                                                                                                                                                                                                 | User choice                                                                                                                                                                      |
| 2026-11-19 | Composite FKs for same-owner/same-project integrity; activity via DB triggers                                                                                                                                                                                    | Atomic and DB-enforced (Spec §8.2, §7.5)                                                                                                                                         |
| 2026-11-19 | `service_instances.project_id` and `task_dependencies.project_id` added beyond the Spec                                                                                                                                                                          | Needed to enforce the Spec's same-project rule in the DB                                                                                                                         |
| 2026-11-19 | Keep Next 16.4 defaults `cacheComponents` + `partialPrefetching`                                                                                                                                                                                                 | Scaffold default; both become always-on in the next major. Session reads go behind Suspense (§5).                                                                                |
| 2026-11-19 | shadcn 4.23 with the Radix base and Nova preset (Geist, Lucide). Components import `cn` from the official `cn` package (shadcn-ui/cn). `form` is replaced by `field` + `empty`/`kbd`/`input-group`                                                               | Current shadcn defaults                                                                                                                                                          |
| 2026-11-19 | Neutral palette, no brand accent; colour is reserved for semantic, status, priority and environment tokens, always paired with an icon or label                                                                                                                  | Spec §3.3 restrained colour                                                                                                                                                      |
| 2026-11-19 | GitHub remote uses HTTPS. Push with `git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push`, because no SSH key is set up and global git config is left unchanged                                                                        | Environment                                                                                                                                                                      |
| 2026-11-19 | Remote CLI database commands authenticate with the database password from gitignored `.env.supabase.local`, which `scripts/supabase.mjs` reads and never prints, instead of the token-created temporary login role. The password must be letters and digits only | Login-role creation returned 403 after one success even with a Database Read-write token. A password with URL-special characters was rejected (28P01) even though it was correct |
| 2026-11-19 | M01 applied by hand in the Supabase SQL Editor because the CLI wasn't installed yet. After `pnpm supabase link`, run `pnpm supabase migration repair --status applied 20261119130441` so `db push` won't apply it again                                          | Unblocks sign-in while the CLI downloads; repair keeps the migration history correct                                                                                             |
| 2026-11-19 | Supabase CLI runs through `scripts/supabase.mjs`: `$SUPABASE_BIN`, then the standalone binary in gitignored `.tools/supabase-cli/`, then `supabase` on PATH (a devDependency wins via node_modules/.bin). It isn't a devDependency for now                       | pnpm can't resume the 67 MB platform package on this connection; curl with resume plus a SHA-512 check is reliable                                                               |
| 2026-11-19 | `createClient()` (server) calls `await connection()` first                                                                                                                                                                                                       | Next 16.4's runtime-prefetch render has cookies but not `Date.now()`, which Supabase uses for token expiry                                                                       |
| 2026-11-19 | Auth email links are built from `NEXT_PUBLIC_SITE_URL`, never the request Host header. `/auth/confirm` accepts both `token_hash` (verifyOtp) and `code` (PKCE). `?next=` only allows same-origin relative paths                                                  | Prevents host-header and open-redirect attacks                                                                                                                                   |
| 2026-11-19 | Dev keeps Supabase's default reset email (PKCE `code` link) until custom SMTP exists (U7, Phase 8). Limitation: open the reset link in the same browser that requested it                                                                                        | Template edits need custom SMTP; `/auth/confirm` already handles both link styles, so no code change is needed later                                                             |
| 2026-11-19 | Password rule: 10–72 characters (72 is the bcrypt limit). Sign-in errors use one generic message, plus a separate rate-limit message                                                                                                                             | Spec FR-01: don't disclose whether an account exists                                                                                                                             |
| 2026-11-19 | M01 revokes default privileges from `anon` on new public tables, sequences and functions; every RPC needs an explicit `grant execute … to authenticated`. `profiles` grants UPDATE only on its editable columns                                                  | Least privilege on top of RLS (Spec §9.2 “review grants as well”)                                                                                                                |
| 2026-11-19 | Auth forms use Server Actions + `useActionState` + Zod. React Hook Form is kept for the larger CRUD forms from Phase 2                                                                                                                                           | Auth forms are tiny; keeps them working without JS                                                                                                                               |

## 11. Progress log

| Date       | Step(s)           | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-19 | P1.1              | Repo initialized; spec moved to docs/; private repo Ahad-dev/devworkspace created and pushed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-11-19 | P1.2              | Next 16.4.6 scaffold (React 19.3, Tailwind 4.3, TS 5.9) with strict TS + `noUncheckedIndexedAccess`, Prettier, scripts dev/build/lint/typecheck/format. Test and db scripts get added with their tools (P1.4, P1.10).                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-11-19 | P1.3              | shadcn components, next-themes, domain tokens (`src/lib/constants/domain.ts`, `domain-badges.tsx`), static shell with sidebar, breadcrumbs, Ctrl/Cmd+K menu, quick-create (disabled until each phase), theme toggle and placeholder user menu. Placeholder pages for all nav areas; `/` redirects to `/dashboard`. Lint, typecheck and build pass; checked in the browser in light, dark and mobile.                                                                                                                                                                                                                                                                   |
| 2026-11-19 | P1.4 (partial)    | Dev project `qkzfjwghrvtkcoicyepp` reachable; `.env.example` + `.env.local`; `@supabase/ssr` 0.12.7, `supabase-js` 2.119.2, zod 4.6.7 installed. CLI install and `supabase init`/link still pending.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-11-19 | P1.5              | `src/lib/supabase/{client,server,proxy}.ts`, `src/proxy.ts`, `src/lib/auth/{routes,session}.ts`. Checked in the browser: `/dashboard` redirects to `/login?next=%2Fdashboard`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-11-19 | P1.6 (drafted)    | `supabase/migrations/20261119130441_foundation.sql` written, not yet pushed (needs link).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-11-19 | P1.7 (built)      | Login, reset-password, update-password, `/auth/confirm`, sign-out; the header user menu reads the session inside Suspense. Checked in the browser: field errors, a generic error for a made-up account, and an invalid link sends you to the link-error message. Real sign-in still needs U4's owner user.                                                                                                                                                                                                                                                                                                                                                             |
| 2026-11-19 | P1.8–P1.9 (built) | `/onboarding` (display name + timezone; sign-in redirects there until the display name is set), Settings with Profile (searchable IANA timezone picker), Appearance (theme control + token preview) and Coming later. The user menu shows display name and initials, and falls back to the email if the profile can't load. Uses temporary hand-written `database.types.ts` until `db:types`.                                                                                                                                                                                                                                                                          |
| 2026-11-19 | P1.4 (ongoing)    | First `pnpm add -D supabase` stalled: the 67 MB `@supabase/cli-windows-x64` package kept timing out at about 140 KB/s. Retried with `--fetch-timeout=900000`. CLI 3.x ships its binary as an optional platform package (no postinstall), so no build-script allowlist is needed.                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-11-19 | P1.11             | `.github/workflows/ci.yml`: format check, lint, typecheck and build on push/PR, with placeholder public env values. Unit tests get added in P1.10.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-11-19 | P1.12             | `README.md` (setup, scripts) and `docs/SECURITY.md` (secret boundary, RLS, keys, auth rules). Public sign-ups confirmed off (`disable_signup: true`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-11-19 | P1.6              | M01 applied via the SQL Editor (owner ran it). Verified: anon SELECT and INSERT on `profiles` → `42501 permission denied`; the owner's profile was backfilled; onboarding and Settings read it (timezone UTC, browser suggests Asia/Karachi).                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-11-19 | Fix               | Next 16 "unstable value Date.now() while prerendering" on workspace routes, from Supabase `getClaims()` in the runtime prefetch. Fixed with `await connection()` in the server client; no new errors after reloading the pages.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-11-19 | P1.7–P1.9         | Owner signed in, completed onboarding (display name set, timezone Asia/Karachi) and landed on the dashboard; Settings shows the saved values; the account menu shows display name, email and Sign out. Clean dev-server restart: no server errors on /dashboard, /settings or /my-work. The reset-email round trip hasn't been tested yet.                                                                                                                                                                                                                                                                                                                             |
| 2026-11-19 | P1.4 (partial)    | CLI 3.2.0 downloaded with curl (SHA-512 matches the registry), installed at `.tools/supabase-cli/`, `supabase init` run, `config.toml` auth aligned (sign-ups off, localhost URLs, 10-character minimum). Linked to `qkzfjwghrvtkcoicyepp`; `migration repair --status applied 20261119130441` succeeded. Scripts use `--remote` (`--linked` is deprecated). **Open:** the CLI token belongs to a different Supabase account (org "nityfool9's Org"), so project-status, type-generation and login-role endpoints return 403. Re-login as the owning account (an access token is most reliable), then run `pnpm db:types` and `pnpm supabase migration list --remote`. |
| 2026-11-19 | P1.4 (types)      | After re-login with the owner's token, `projects list` shows `devworkspace-dev` (ACTIVE_HEALTHY, linked) and `pnpm db:types` generated `src/types/database.types.ts` (replacing the hand-written version). Lint, typecheck, format and build pass. `migration list --remote` still gets 403 on login-role creation: Supabase PATs are scoped, and this token lacks Database Read-write.                                                                                                                                                                                                                                                                                |
| 2026-11-19 | P1.4              | `migration list --remote` with the DB password: `local 20261119130441 = remote 20261119130441`, so the history is in sync. The pooler connection on this network is flaky (about half of connections drop with "Connection terminated unexpectedly"), so DB commands may need a few retries.                                                                                                                                                                                                                                                                                                                                                                           |
