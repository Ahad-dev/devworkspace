# DevWorkspace

A personal engineering workspace: projects, repositories, a native task manager, work sessions
with handoffs, environment and service registries, a technical knowledge base, and Accounts with
an end-to-end encrypted password vault (values are encrypted in your browser; the server only
ever holds ciphertext, see [docs/SECURITY.md](docs/SECURITY.md) §8), in one place.

- **What it does:** [docs/DevWorkspace_Full_Product_and_Implementation_Specification.md](docs/DevWorkspace_Full_Product_and_Implementation_Specification.md)
- **Build plan and progress:** [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)
- **Security rules:** [docs/SECURITY.md](docs/SECURITY.md)

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript (strict) · Tailwind CSS 4 ·
shadcn/ui (Radix) · Zod · Supabase (Auth, Postgres + RLS, Storage) · pnpm

## Prerequisites

- Node.js 24 and pnpm 10
- Supabase CLI 3.x (see [Supabase CLI](#supabase-cli))
- Access to the hosted Supabase dev project (`devworkspace-dev`)

## Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Create `.env.local` from the example and fill in the dev project's URL and **publishable** key:

   ```bash
   cp .env.example .env.local
   ```

3. Link the Supabase CLI to the dev project. Log in with a personal access token scoped to the project
   with Database + Migrations Read-write, then link. Put the database password (letters and digits only)
   in a gitignored `.env.supabase.local` as `SUPABASE_DB_PASSWORD=...`; the `db:*` scripts read it:

   ```bash
   pnpm supabase login
   pnpm supabase link --project-ref <project-ref>
   ```

4. Apply migrations and regenerate types:

   ```bash
   pnpm db:push
   pnpm db:types
   ```

5. Start the app at http://localhost:3000:

   ```bash
   pnpm dev
   ```

Public sign-up is disabled. Create your account in the Supabase dashboard under
Authentication → Users → Add user.

## Scripts

| Script                                                              | What it does                                                                                                                                                                         |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm dev`                                                          | Dev server                                                                                                                                                                           |
| `pnpm build` / `pnpm start`                                         | Production build / serve                                                                                                                                                             |
| `pnpm lint`                                                         | ESLint                                                                                                                                                                               |
| `pnpm typecheck`                                                    | Route types + `tsc --noEmit`                                                                                                                                                         |
| `pnpm format` / `pnpm format:check`                                 | Prettier write / check                                                                                                                                                               |
| `pnpm db:new <name>`                                                | New SQL migration in `supabase/migrations/`                                                                                                                                          |
| `pnpm db:push`                                                      | Apply pending migrations to the **linked** project                                                                                                                                   |
| `pnpm db:types`                                                     | Regenerate `src/types/database.types.ts`                                                                                                                                             |
| `pnpm supabase <args>`                                              | Any Supabase CLI command                                                                                                                                                             |
| `node scripts/seed-dev.mts`                                         | Busy sample workspace for a throwaway dev user (`--delete` removes it)                                                                                                               |
| `node scripts/import-projects.mts <file> [--dry-run] [--only keys]` | One-off owner import of real projects from a reviewed data file (gitignored `imports/`). Signs in as the owner with a hidden password prompt; `--dry-run` only validates and screens |
| `node scripts/import-rehearse.mts <file> [--keep]`                  | Runs that import against a throwaway user, checks it, re-runs it (all skipped), deletes the user (`--delete` removes a kept one)                                                     |

## Testing

| Command         | What it runs                                                                |
| --------------- | --------------------------------------------------------------------------- |
| `pnpm test`     | Unit tests (no network)                                                     |
| `pnpm test:int` | Integration tests: RLS and constraints against the **dev** Supabase project |
| `pnpm test:e2e` | Playwright browser tests (starts `pnpm dev` if it isn't running)            |
| `pnpm test:pwa` | Install files, service worker and offline reading on a production build     |

`pnpm test:pwa` runs `pnpm build && pnpm start --port 3100` (service workers only run in production builds,
and port 3100 keeps a worker away from `pnpm dev` on 3000). It reuses a server already on 3100, so stop any
older build there first.

Integration and e2e tests create throwaway users and delete them afterwards. They need a gitignored
`.env.test.local` with `SUPABASE_TEST_PROJECT_REF` and the dev project's `SUPABASE_SECRET_KEY` (sb_secret_…).
They refuse to run if `NEXT_PUBLIC_SUPABASE_URL` points at any other project. Locally, e2e uses your installed
Chrome (`PW_CHANNEL=msedge` for Edge); CI uses Playwright's Chromium.

## Installing the app and offline use

DevWorkspace can be installed from the browser (Chrome or Edge: the install icon in the address bar, or
Settings → This device; iPhone and iPad: Safari → Share → Add to Home Screen, then sign in inside the app).
While you use it online, the app keeps a copy of your open and recently completed tasks in that browser. Without
a connection, pages show that saved copy, read-only; edits need a connection. Signing out deletes the copy, and
it can be switched off per device in Settings → This device. Details: Plan Phase 9 and `docs/SECURITY.md` §7.
`node scripts/generate-icons.mts` regenerates the app icons.

## Supabase CLI

The scripts run the CLI through `scripts/supabase.mjs`, which uses the first one it finds:

1. `$SUPABASE_BIN`
2. `.tools/supabase-cli/supabase(.exe)`: a standalone binary (gitignored)
3. `supabase` on PATH, including a `supabase` devDependency if one is installed

On a fast connection, `pnpm add -D supabase` is the simplest option. On a slow one, download the official
binary for your platform (the npm package `@supabase/cli-<platform>` or a GitHub release of
`supabase/cli`), check its SHA-512, and put the executable at `.tools/supabase-cli/`.

Database changes only happen through migration files. Never edit an applied migration; add a new one.

## Operations and security

- [docs/OPERATIONS.md](docs/OPERATIONS.md): environments, migrations to production, backups, the restore
  drill, and what to do when something breaks.
- [docs/SECURITY.md](docs/SECURITY.md): the secrets boundary, the Accounts vault and its limits, keys, headers and the RLS audit.
