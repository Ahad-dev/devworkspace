# Security rules

DevWorkspace stores **context about** infrastructure, not the keys to it. These rules come from the
Spec (§9) and are enforced in code, in the database, and in review.

## 1. Secrets never enter DevWorkspace in plain form

The only exception is the end-to-end encrypted Accounts vault (§8): secret values stored there exist on the
server only as ciphertext made in the owner's browser.

Allowed: environment-variable **names**, required/sensitive flags, configuration status, safe notes,
vault provider + locator (e.g. Infisical project/path/key name), non-secret URLs and hostnames.

Never stored in plain form in any table, form, log, URL, activity entry or browser storage:

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

## 7. Installed app and offline copy (Phase 9)

- **What is on the device.** One IndexedDB record (`devworkspace-offline`) holding a copy of the
  signed-in user's tasks: open tasks and those completed in the last 14 days, with project and
  repository names, labels, links, dependencies and the last 20 comments. Nothing else: no handoffs,
  documents, environments or variable metadata. DevWorkspace holds no secret values, and the secret
  guard already keeps them out of task text. The copy is not encrypted at rest, like any browser
  data, so "Keep a copy of my tasks on this device" (Settings → This device) can be turned off on a
  shared computer.
- **When it is deleted.** On the sign-in page (every way out of a session ends there: sign-out,
  account deletion, an expired or revoked session), before the sign-out request is sent, when a
  different user signs in, from Settings, and when it is more than 30 days old. A device signed out
  remotely ("Sign out other sessions") keeps its copy until it next reaches the server; the 30-day
  limit is the backstop.
- **What the service worker stores.** Only the static `/offline` page, hashed `/_next/static` build
  files and the app icons. It never stores workspace pages, RSC payloads, server-action requests or
  Supabase responses, and it only handles same-origin GET requests. The `/offline` page's HTML holds
  no user data: the saved copy is read in the browser (checked by `pnpm test:pwa`).
- **Public files.** `/sw.js`, `/manifest.webmanifest` and `/offline` skip the auth proxy (browsers
  fetch the manifest without cookies). `/sw.js` is never cached and has its own CSP:
  `default-src 'self'; script-src 'self'; connect-src 'self'`. The app's CSP already allowed
  `worker-src 'self'` and `manifest-src 'self'`.
- **Edits offline** are never queued: they fail with "You're offline. Reconnect to save this change."

## 8. Accounts vault (Phase 11)

The owner decided (2026-11-27, Plan §10) that DevWorkspace keeps the credentials for their platform accounts
(Neon, Resend, Vercel…) itself, overriding Spec §2.3 and §9.3. It is built so the server never holds anything
readable:

- **Zero-knowledge.** A random 256-bit vault key encrypts every item (AES-256-GCM, a fresh 12-byte IV per write,
  associated data binding the item to its id and account, plaintext padded to hide its exact length). The vault
  key is stored only wrapped: by a key derived from the **master password** (PBKDF2-SHA256, 600,000 iterations,
  random salt) and by a key derived from the printable **recovery key** (32 random bytes, HKDF). All of it runs
  in the browser with WebCrypto; there is no crypto dependency.
- **What the server sees.** Ciphertext, IVs, salts, wrapped keys and non-secret metadata: platform, label, login
  email or username, login URL, two-factor method, notes, and each item's label and kind. Vault writes are typed
  JSON actions that accept ciphertext only; secret inputs have no `name` attribute, so a form can never post them.
- **In the browser.** After unlock the vault key is held in memory as a non-extractable key, never in storage,
  React props, URLs or logs. The vault locks after 15 minutes idle, when the page is hidden for good (`pagehide`),
  on sign-out, on the sign-in page and in every tab at once. Revealed values hide again after 30 seconds; copied
  values are cleared from the clipboard after 30 seconds where the browser allows it.
- **Never included:** activity metadata, global search, the offline copy of tasks, the service-worker cache.
  Exports contain the vault tables **encrypted** (readable only with the master password or recovery key).
- **Limits, stated plainly.** The vault protects against anyone who reads the database, a backup, an export,
  Supabase or Vercel. It does **not** protect against compromised app code (a malicious deploy or dependency, an
  XSS bug), a malicious browser extension or an infected device while the vault is unlocked: such code could ask
  the browser to decrypt. Forgetting both the master password and the recovery key loses the stored secrets for
  good; nobody can reset them. Windows clipboard history and cloud clipboards may keep copied values.
- **Advice to the owner.** Use a master password you use nowhere else (not the DevWorkspace sign-in password),
  keep the recovery key offline, and lock the vault on shared computers.

## 9. Reporting

Found something that breaks these rules? Treat it as a bug with top priority: fix it, add a test,
and note it in the Plan's decision log.
