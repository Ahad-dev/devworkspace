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

| Variable                               | Exposure                                                   | Where                                                                                                   |
| -------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Public                                                     | `.env.local`, Vercel                                                                                    |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public (RLS protects data)                                 | `.env.local`, Vercel                                                                                    |
| `NEXT_PUBLIC_SITE_URL`                 | Public                                                     | `.env.local`, Vercel                                                                                    |
| `SUPABASE_SECRET_KEY`                  | **Server-only**, bypasses RLS                              | `.env.test.local` (dev project, tests only); production only if a server-only feature needs it          |
| `SUPABASE_DB_PASSWORD`                 | **Local only**, dev database password for the Supabase CLI | `.env.supabase.local` (gitignored), read only by `scripts/supabase.mjs`; never in chat, commits or logs |

- The secret key is only imported from `server-only` modules. It never gets a `NEXT_PUBLIC_` prefix.
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

- Attachments live in a private bucket, under paths scoped to the owner, and are served through short-lived
  signed URLs. File type and size are allowlisted; no SVG or HTML.
- Markdown is rendered sanitized (no raw HTML, no `javascript:` links).

## 6. Reporting

Found something that breaks these rules? Treat it as a bug with top priority: fix it, add a test,
and note it in the Plan's decision log.
