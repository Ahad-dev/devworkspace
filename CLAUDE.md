# DevWorkspace — instructions for Claude

## Source of truth

- **What to build:** `docs/DevWorkspace_Full_Product_and_Implementation_Specification.md` (the "Spec").
- **How / in what order:** `docs/IMPLEMENTATION_PLAN.md` (the "Plan"). Read the Plan's current phase before starting work.

Next.js agent rules (this Next version differs from older training data): @AGENTS.md

## Working rules

- Work phase by phase, step by step (step IDs like `P3.4`). Don't jump ahead or build post-MVP features.
- When a step meets the Plan's Definition of Done (§8), tick its checkbox and add a line to the Progress log (§11).
- Record any deviation from the Spec or Plan in the Decision log (§10) before or while making it.
- Steps marked **(U)** need the user (accounts, passwords, tokens, dashboards). Ask, don't work around them.
- Commit only when the user asks. Never push to production or run `db push` against prod without explicit approval.
- **The hosted Supabase project is also production** (owner's decision, 2026-11-20; Plan §10). Every
  `pnpm db:push` changes the live database: list the pending migrations and get the owner's OK before each push.
- Never run `supabase db reset` against the hosted project: it would wipe production. Restore drills go into a
  temporary scratch project (`docs/OPERATIONS.md` §4).
- Tests and scripts only ever touch throwaway users (`test-*@devworkspace.test`) that they create and delete;
  never the owner's account or data. One exception: `scripts/import-projects.mts`, which only the owner runs,
  signing in with their own password in their own terminal.
- Claude never asks for, types or reads the owner's password. For the import, Claude may run `--dry-run` and
  `scripts/import-rehearse.mts` (throwaway user) only.

## Stack

Next.js 16 (App Router, `src/`), React 19, TypeScript strict, Tailwind 4, shadcn/ui, RHF + Zod 4,
Supabase (hosted dev project; Auth, Postgres + RLS, Storage), Vitest, Playwright. Package manager: **pnpm**.

## Security boundaries (never violate)

- DevWorkspace stores secret **references and metadata only**. No column, form, log, URL or activity metadata may hold
  secret values (API keys, passwords, credential-bearing URLs, private keys, tokens, `.env` contents).
- RLS on every table. Ownership comes from `auth.uid()`, never from client-supplied `owner_id`.
- The Supabase secret key (`SUPABASE_SECRET_KEY`) is only used in `server-only` modules and test helpers. It is never in
  `NEXT_PUBLIC_*` vars or browser code. `.env.local` / `.env.test.local` are gitignored.

## Commands

Filled in as scripts are added (see `package.json`).

| Command                                                 | Purpose                                                                                                   |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                              | Dev server on http://localhost:3000                                                                       |
| `pnpm lint` / `pnpm typecheck` / `pnpm build`           | Checks run by CI                                                                                          |
| `pnpm format` / `pnpm format:check`                     | Prettier write / check                                                                                    |
| `pnpm test`                                             | Unit tests (CI)                                                                                           |
| `pnpm test:int`                                         | Integration tests against the dev project (needs `.env.test.local`)                                       |
| `pnpm test:e2e`                                         | Playwright e2e in local Chrome (needs `.env.test.local`)                                                  |
| `pnpm db:new <name>` / `pnpm db:push` / `pnpm db:types` | Migrations and generated types (`db:push` targets the linked dev project; pass `--yes` non-interactively) |

## Git

- Remote is HTTPS (`Ahad-dev/devworkspace`, private) and no SSH key is set up. Push with:
  `git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push`
