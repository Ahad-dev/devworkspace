# Operations

How DevWorkspace runs, how to back it up and restore it, and what to do when something breaks.
Spec §9.6, §10, §18; Plan P8.5–P8.7. Commands are run from the repository root in PowerShell or bash.

## 1. What runs where

**One Supabase project serves both development and production** (owner's decision, 2026-11-20; Plan §10).
Local development and the live site read and write the same database, Auth and Storage.

| Piece                  | Development                         | Production                          |
| ---------------------- | ----------------------------------- | ----------------------------------- |
| App                    | `pnpm dev` on http://localhost:3000 | Vercel project `devworkspace`       |
| Database, Auth, Files  | Supabase `devworkspace-dev`         | **the same project**                |
| Schema                 | `supabase/migrations/` in this repo | the same migrations (one database)  |
| Source of truth (code) | GitHub `devworkspace` (private)     | `main` deploys to Vercel production |

The repository is the source of truth for the schema: every table, policy, function, trigger and the
`attachments` Storage bucket is created by a committed migration. Data and files live only in Supabase.

What sharing one project means in practice:

- **Every migration is a production change.** Pending migrations are listed and approved by the owner
  before each `pnpm db:push`.
- **Never run `supabase db reset`** against it: that would wipe production. Restore drills use a
  temporary scratch project (§4).
- **Automated tests run against it.** They only create throwaway users (`test-*@devworkspace.test`),
  whose rows RLS keeps apart from yours, and delete them when they finish. If a run is interrupted,
  delete any leftover `test-…` users under Authentication → Users.
- Data you enter on `localhost` is your real data.

### Environment variables

| Variable                               | Local                     | Vercel (Production scope)                                    |
| -------------------------------------- | ------------------------- | ------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | `.env.local`              | project URL (set)                                            |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local`              | publishable key (set)                                        |
| `NEXT_PUBLIC_SITE_URL`                 | `http://localhost:3000`   | the production URL, `https://…` (set)                        |
| `SUPABASE_SECRET_KEY`                  | `.env.test.local` (tests) | secret key, **not** `NEXT_PUBLIC_`, marked Sensitive (to do) |

`SUPABASE_SECRET_KEY` bypasses RLS. Because the project is production, `.env.test.local` now holds a
production secret: keep it on your machine only. Without the key on Vercel, account deletion shows as
unavailable on the live site; everything else works. Changing a `NEXT_PUBLIC_` value needs a redeploy:
it is built into the browser bundle and the CSP.

## 2. Applying migrations

```
pnpm supabase migration list --remote
pnpm db:push --yes
```

Run the list first and push only after the owner has read and approved the pending migrations.
Before a migration that rewrites data or drops anything, take a backup (§3).

## 3. Backups

Three layers, from least to most effort:

1. **Supabase's own backups.** What your plan includes is shown under Database → Backups in the
   dashboard. On paid plans there are daily backups; Point-in-Time Recovery is an add-on. Check the
   page and write the answer here: _(plan, retention, PITR yes/no)_.
2. **Your own logical dump** (needs Docker Desktop running; the CLI runs `pg_dump` in a container):

   ```
   pnpm supabase db dump --remote -f backups/<date>-schema.sql
   pnpm supabase db dump --remote --data-only --use-copy -f backups/<date>-data.sql
   pnpm supabase db dump --remote --role-only -f backups/<date>-roles.sql
   ```

   `backups/` is gitignored because it holds personal data. Store the files somewhere private and
   encrypted. Dumps don't include Storage files.

3. **The in-app export** (Settings → Your data): a JSON of every record with a schema version, and a
   ZIP of documents as Markdown with their attached files. This is the only layer that includes
   attachment files, so take one after uploading anything you can't recreate.

Suggested rhythm for a one-person workspace: the in-app export weekly and before big changes; a
logical dump monthly and before every migration.

## 4. Restore drill (into a scratch project)

Prove that a backup restores before you need it. Never into the live project.

1. Take a dump (§3, step 2) and an in-app export.
2. Create a temporary Supabase project (any free one). Link the CLI to it only for this drill.
3. Apply every migration to it: `pnpm supabase db push --remote=<scratch-ref>`.
4. Load the data: in the scratch project's SQL editor run the roles file, then the data file (or with
   a local `psql`: `psql "<scratch connection string>" -f backups/<date>-data.sql`). Auth users live in
   the `auth` schema; include it in the dump (`--schema auth,public`) if you restore sign-ins too.
5. Point a local build at it (a temporary `.env.local`), sign in and check: projects, tasks, sessions
   with handoffs, environments with variable names and secret references, documents.
6. Restore your normal `.env.local` and CLI link, delete the scratch project, and record the date,
   what was restored and how long it took in the Plan's progress log.

## 5. If something goes wrong

**The app is down or erroring.** Vercel → Deployments: promote the previous production deployment
(instant rollback). Then read the function logs for the failing request. Logs hold error codes and
counts only, never values.

**Supabase project paused** (free plans pause after a week without activity). Restore it from the
dashboard; nothing is lost.

**A migration broke something.** Don't edit applied migrations. Write a new migration that fixes
forward, review it, push it. If data was damaged, restore the latest backup into a scratch project
(§4), compare, then repair the live data with a reviewed SQL script.

**A key leaked.** Supabase → Project Settings → API keys: roll the affected key. Update Vercel env vars
(and `.env.local` / `.env.test.local`), redeploy, and check the Auth logs for sign-ins you don't
recognise. Rolling the publishable key signs everyone out; rolling the secret key only affects
account deletion and tests.

**The project is lost** (deleted, or the account is gone):

1. Create a new Supabase project; set Auth as in §6.
2. Apply every migration: `pnpm supabase db push --remote=<new-ref>`.
3. Restore the latest dump (§4, step 4) or, without one, rebuild from the in-app JSON export.
4. Re-upload attachments from the documents ZIP.
5. Point `.env.local`, `.env.test.local` and Vercel's env vars at the new project and redeploy.
6. Vault secrets were never in DevWorkspace, so nothing there needs restoring; secret references
   still point at the same vault items.

## 6. Production setup checklist (Plan P8.5)

Already done: one project for both (§1), every migration applied, public sign-ups off, your owner user,
the private `attachments` bucket and its policies, Vercel's three public env vars.

- [ ] Authentication → URL Configuration: **Site URL** = the production URL. **Redirect URLs** include
      `https://<production domain>/auth/confirm` and `http://localhost:3000/auth/confirm` (so password
      reset works from both).
- [ ] Authentication → Emails → SMTP: your own email provider. The built-in sender is rate limited and
      meant for testing; password-reset emails need a real sender.
- [ ] Vercel → Settings → Environment Variables: add `SUPABASE_SECRET_KEY` (Production only, Sensitive),
      then redeploy. Account deletion then works on the live site.
- [ ] Advisors (Security and Performance) in the dashboard show no errors.
- [ ] Storage → `attachments` shows **Private**, 10 MB file limit, the allowed types from the migration.
- [ ] Optional: a custom domain on Vercel; then update `NEXT_PUBLIC_SITE_URL` and the Auth URLs above.
- [ ] First backup taken (§3) and one restore drill done (§4).
- [ ] Production smoke test (Plan P8.7), then the Spec §18 release checklist.
