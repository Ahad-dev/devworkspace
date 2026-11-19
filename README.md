# DevWorkspace

A personal engineering workspace: projects, repositories, a native task manager, work sessions
with handoffs, environment and service registries, and a technical knowledge base, in one place.

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

| Script                              | What it does                                       |
| ----------------------------------- | -------------------------------------------------- |
| `pnpm dev`                          | Dev server                                         |
| `pnpm build` / `pnpm start`         | Production build / serve                           |
| `pnpm lint`                         | ESLint                                             |
| `pnpm typecheck`                    | Route types + `tsc --noEmit`                       |
| `pnpm format` / `pnpm format:check` | Prettier write / check                             |
| `pnpm db:new <name>`                | New SQL migration in `supabase/migrations/`        |
| `pnpm db:push`                      | Apply pending migrations to the **linked** project |
| `pnpm db:types`                     | Regenerate `src/types/database.types.ts`           |
| `pnpm supabase <args>`              | Any Supabase CLI command                           |

## Supabase CLI

The scripts run the CLI through `scripts/supabase.mjs`, which uses the first one it finds:

1. `$SUPABASE_BIN`
2. `.tools/supabase-cli/supabase(.exe)`: a standalone binary (gitignored)
3. `supabase` on PATH, including a `supabase` devDependency if one is installed

On a fast connection, `pnpm add -D supabase` is the simplest option. On a slow one, download the official
binary for your platform (the npm package `@supabase/cli-<platform>` or a GitHub release of
`supabase/cli`), check its SHA-512, and put the executable at `.tools/supabase-cli/`.

Database changes only happen through migration files. Never edit an applied migration; add a new one.
