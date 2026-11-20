# Operations

How DevWorkspace runs, how to back it up and restore it, and what to do when something breaks.
Spec §9.6, §10, §18; Plan P8.5–P8.7. Commands are run from the repository root in PowerShell or bash.

## 1. What runs where

| Piece                  | Development                         | Production                               |
| ---------------------- | ----------------------------------- | ---------------------------------------- |
| App                    | `pnpm dev` on http://localhost:3000 | Vercel project `devworkspace`            |
| Database, Auth, Files  | Supabase `devworkspace-dev`         | Supabase `devworkspace-prod` (separate)  |
| Schema                 | `supabase/migrations/` in this repo | the same migrations, pushed after review |
| Source of truth (code) | GitHub `devworkspace` (private)     | `main` deploys to Vercel production      |

The repository is the source of truth for the schema: every table, policy, function, trigger and the
`attachments` bucket is created by a committed migration. Data and files live only in Supabase.

### Environment variables

| Variable                               | Development       | Production (Vercel, Production scope)                      |
| -------------------------------------- | ----------------- | ---------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | `.env.local`      | prod project URL                                           |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local`      | prod publishable key                                       |
| `NEXT_PUBLIC_SITE_URL`                 | `.env.local`      | the production domain, `https://…`                         |
| `SUPABASE_SECRET_KEY`                  | `.env.test.local` | prod secret key, **not** `NEXT_PUBLIC_` (account deletion) |

Changing a `NEXT_PUBLIC_` value needs a redeploy: it is built into the browser bundle and the CSP.

## 2. Applying migrations

Development (the linked project):

```
pnpm db:push --yes
```

Production: only after the owner has read the list of pending migrations.

```
pnpm supabase migration list --remote=<prod-ref> --password "<prod db password>"
pnpm supabase db push --remote=<prod-ref> --password "<prod db password>"
```

Type the password in your own terminal (or put it in `.env.supabase.local` as `SUPABASE_DB_PASSWORD`
while you work on prod, then switch it back). Never paste it into chat, commits or issues.
Never run `supabase db reset` against production.

## 3. Backups

Three layers, from least to most effort:

1. **Supabase's own backups.** What your plan includes is shown under Database → Backups in the
   dashboard. On paid plans there are daily backups; Point-in-Time Recovery is an add-on. Check the
   page after the production project is created and write the answer here: _(plan, retention, PITR yes/no)_.
2. **Your own logical dump** (needs Docker Desktop running; the CLI runs `pg_dump` in a container):

   ```
   pnpm supabase db dump --remote=<prod-ref> -f backups/<date>-schema.sql
   pnpm supabase db dump --remote=<prod-ref> --data-only --use-copy -f backups/<date>-data.sql
   pnpm supabase db dump --remote=<prod-ref> --role-only -f backups/<date>-roles.sql
   ```

   `backups/` holds personal data: keep it out of git (add it to `.gitignore` before the first dump)
   and store the files somewhere private and encrypted. Dumps don't include Storage files.

3. **The in-app export** (Settings → Your data): a JSON of every record with a schema version, and a
   ZIP of documents as Markdown with their attached files. This is the only layer that includes
   attachment files, so take one after uploading anything you can't recreate.

Suggested rhythm for a one-person workspace: the in-app export weekly and before big changes; a
logical dump monthly and before every production migration.

## 4. Restore drill (into the dev project)

Prove that a backup restores before you need it. The dev project is the target: the drill wipes it.

1. Take a production dump (§3, step 2) and an in-app export.
2. With the owner's explicit OK, reset dev: `pnpm supabase db reset --remote` (applies every
   migration to an empty database).
3. Load the data: in the dev project's SQL editor run the roles file, then the data file (or with a
   local `psql`: `psql "<dev connection string>" -f backups/<date>-data.sql`). Auth users live in
   the `auth` schema; include it in the dump (`--schema auth,public`) if you restore sign-ins too.
4. Sign in on a dev build (`pnpm dev`) and check: projects, tasks, sessions with their handoffs,
   environments with variable names and secret references, documents. Attachment rows will point to
   files that aren't in dev Storage; re-upload from the ZIP if you want to check those too.
5. Record the date, what was restored and how long it took in the Plan's progress log.

## 5. If something goes wrong

**The app is down or erroring.** Vercel → Deployments: promote the previous production deployment
(instant rollback). Then read the function logs for the failing request. Logs hold error codes and
counts only, never values.

**Supabase project paused** (free plans pause after a week without activity). Restore it from the
dashboard; nothing is lost.

**A migration broke production.** Don't edit applied migrations. Write a new migration that fixes
forward, review it, push it. If data was damaged, restore from the latest backup into dev first (§4),
compare, then repair production with a reviewed SQL script.

**A key leaked.** Supabase → Project Settings → API keys: roll the affected key. Update Vercel env vars
(and `.env.local` / `.env.test.local`), redeploy, and check the Auth logs for sign-ins you don't
recognise. Rolling the publishable key signs everyone out; rolling the secret key only affects
account deletion and tests.

**The project is lost** (deleted, or the account is gone):

1. Create a new Supabase project; set Auth as in §6.
2. Apply every migration: `pnpm supabase db push --remote=<new-ref>`.
3. Restore the latest dump (§4, step 3) or, without one, rebuild from the in-app JSON export.
4. Re-upload attachments from the documents ZIP.
5. Point Vercel's env vars at the new project and redeploy.
6. Vault secrets were never in DevWorkspace, so nothing there needs restoring; secret references
   still point at the same vault items.

## 6. Production setup checklist (Plan P8.5)

- [ ] Supabase project `devworkspace-prod` in a nearby region; database password in your password manager.
- [ ] Auth: public sign-ups **off**; Site URL = production domain; redirect URL `https://<domain>/auth/confirm`;
      custom SMTP for password-reset email; owner user created under Users → Add user.
- [ ] Migrations reviewed (`migration list`) and pushed (§2).
- [ ] Security Advisor and Performance Advisor in the dashboard show no errors.
- [ ] Vercel production env vars set (§1), domain added, HTTPS on.
- [ ] Production smoke test (Plan P8.7), then the Spec §18 release checklist.
- [ ] First backup taken (§3) and one restore drill done (§4).
