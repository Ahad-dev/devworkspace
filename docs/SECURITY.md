# Security rules

DevWorkspace stores **context about** infrastructure, not the keys to it. These rules come from the
Spec (§9) and are enforced in code, in the database, and in review.

## 1. Secrets never enter DevWorkspace

Allowed: environment-variable **names**, required/sensitive flags, configuration status, safe notes,
vault provider + locator (e.g. Infisical project/path/key name), non-secret URLs and hostnames.

Never stored in any table, form, log, URL, activity entry or browser storage:

- API keys, passwords, tokens (OAuth, PAT, JWT), private/signing keys, SSH keys
- Connection strings that contain credentials (`postgres://user:pass@…`)
- Service-account JSON, `.env` file contents

How this is enforced:

- `environment_variables` has **no value column**, and a test asserts that.
- URL and hostname columns have DB checks rejecting `user:pass@` credentials.
- `src/lib/security/secret-guard.ts` (Phase 2) rejects or warns on credential-looking input.
- Activity metadata only holds ids, names and enum values, never free text.

## 2. Authorization is in the database

- RLS is enabled on every table, with separate select/insert/update/delete policies using
  `(select auth.uid()) = owner_id`.
- Ownership comes from `auth.uid()`, never from a client-supplied `owner_id`.
- Composite foreign keys make the database reject links across owners or projects.
- `anon` has no privileges on application tables (default privileges are revoked in M01).
- Route protection in `src/proxy.ts` only redirects; it is **not** the security boundary.

## 3. Keys and environment variables

| Variable                               | Exposure                                                   | Where                                                                                                                                            |
| -------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | Public                                                     | `.env.local`, Vercel                                                                                                                             |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public (RLS protects data)                                 | `.env.local`, Vercel                                                                                                                             |
| `NEXT_PUBLIC_SITE_URL`                 | Public                                                     | `.env.local`, Vercel                                                                                                                             |
| `SUPABASE_SECRET_KEY`                  | **Server-only**, bypasses RLS                              | `.env.test.local` (tests) and Vercel (account deletion), never `NEXT_PUBLIC_`. One project is dev and production, so this is a production secret |
| `SUPABASE_DB_PASSWORD`                 | **Local only**, dev database password for the Supabase CLI | `.env.supabase.local` (gitignored), read only by `scripts/supabase.mjs`; never in chat, commits or logs                                          |

- The secret key is only imported from `server-only` modules (`src/lib/supabase/admin.ts`). Its one runtime
  use is deleting the signed-in user's own account after the password is re-entered. It never gets a
  `NEXT_PUBLIC_` prefix; without it, account deletion is shown as unavailable.
  `src/lib/env.ts` refuses a `sb_secret_` value in the public key slot.
- `.env*` files are gitignored except `.env.example`.

## 4. Auth

- Public sign-up is disabled in Supabase Auth; the owner account is created in the dashboard.
- Sign-in errors use one generic message, so they never reveal whether an account exists.
  Password reset always shows the same confirmation.
- Email links are built from `NEXT_PUBLIC_SITE_URL`, never from the request Host header.
- `?next=` redirects only accept same-origin relative paths.
- Server code verifies the session with `getClaims()`, not `getSession()`.

## 5. Files and rendering (Phase 6)

- Uploads are typed by extension on the server and re-wrapped with that type in the browser (Storage
  ignores the content-type option for Blobs). Text files are screened for secrets before upload.

- Attachments live in a private bucket, under paths scoped to the owner, and are served through short-lived
  signed URLs. File type and size are allowlisted; no SVG or HTML.
- Markdown is rendered sanitized (no raw HTML, no `javascript:` links).

## 6. Headers, logs and audits (Phase 8)

- `next.config.ts` sends a Content Security Policy (self plus the Supabase project only, no framing, no
  plugins, forms to self), `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy, a restrictive
  Permissions-Policy and HSTS in production. Scripts keep `'unsafe-inline'` because Cache Components
  prerender a static shell, which rules out per-request nonces; raw HTML is never rendered.
- Logs record counts and error codes only: no values, tokens, URLs with credentials or request bodies.
- `tests/integration/rls-audit.test.ts` reads the list of exposed tables from the live API and checks,
  for every table and view, that another user and an anonymous visitor can't read, change, delete or
  attach to the owner's rows. A new table without an audit entry fails it.
- `pnpm supabase db lint --remote` is clean. The Security and Performance Advisors need a dashboard
  check (the CLI token can't read them).
- The one-off owner import (`scripts/import-projects.mts`, Plan §10) uses only the public URL and
  publishable key from `.env.local` (it refuses a `sb_secret_` key) plus the owner's own sign-in, typed
  hidden in their terminal and never stored or logged. Every row goes through RLS and the column grants;
  it never sends `owner_id`. Before any write it validates the whole file and runs the secret guard on
  every string and every document line, reporting only the path or `file:line` and the kind of finding.
  Variables are imported by name only. The data file and copied documents live in the gitignored
  `imports/` folder.

## 7. Reporting

Found something that breaks these rules? Treat it as a bug with top priority: fix it, add a test,
and note it in the Plan's decision log.
