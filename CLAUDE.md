# DevWorkspace — instructions for Claude

## Source of truth
- **What to build:** `docs/DevWorkspace_Full_Product_and_Implementation_Specification.md` (the "Spec").
- **How / in what order:** `docs/IMPLEMENTATION_PLAN.md` (the "Plan"). Read the Plan's current phase before starting work.

## Working rules
- Work phase by phase, step by step (step IDs like `P3.4`). Don't jump ahead or build post-MVP features.
- When a step meets the Plan's Definition of Done (§8), tick its checkbox and add a line to the Progress log (§11).
- Record any deviation from the Spec or Plan in the Decision log (§10) before or while making it.
- Steps marked **(U)** need the user (accounts, passwords, tokens, dashboards). Ask, don't work around them.
- Commit only when the user asks. Never push to production or run `db push` against prod without explicit approval.
- `supabase db reset --linked` wipes the hosted dev DB. Run it only with the user's explicit OK.

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

| Command | Purpose |
|---|---|
| `pnpm dev` | Dev server on http://localhost:3000 |
| `pnpm lint` / `pnpm typecheck` / `pnpm build` | Checks run by CI |
| `pnpm format` | Prettier write |
