/**
 * Detects secret material in user-entered text (Spec §9.3, Plan §5).
 * DevWorkspace stores references to secrets, never their values; forms reject text that looks
 * like a credential. Heuristic by design: aim for high-confidence patterns, and always tell the
 * user why so they can rephrase (e.g. use a $PLACEHOLDER or a vault reference instead).
 */

export type SecretFinding = { kind: string; message: string }

const RULES: { kind: string; re: RegExp; message: string }[] = [
  {
    kind: "credential-url",
    re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s/?#@:]*:[^\s/?#@]+@/i,
    message: "a URL with an embedded username and password",
  },
  {
    kind: "token-url",
    re: /\bhttps?:\/\/[A-Za-z0-9_-]{20,}@/,
    message: "a URL with an embedded access token",
  },
  {
    kind: "query-secret",
    re: /[?&](?:access_token|token|api_key|apikey|key|secret|client_secret|password|sig|signature)=[^&\s#]{8,}/i,
    message: "a URL with a secret in its query string",
  },
  {
    kind: "private-key",
    re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    message: "a private key",
  },
  {
    kind: "jwt",
    re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/,
    message: "a JSON Web Token",
  },
  {
    kind: "known-key",
    re: /\b(?:sk_live_|rk_live_|sk_test_|ghp_|gho_|ghu_|ghs_|ghr_|github_pat_|glpat-|xox[abposr]-|sb_secret_|sbp_|npm_[A-Za-z0-9]{20}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30}|SG\.[A-Za-z0-9_-]{16,})/,
    message: "an API key or access token",
  },
  {
    kind: "assignment",
    // KEY=value where the key names a secret and the value is a literal (not $VAR or <placeholder>).
    re: /\b[A-Za-z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|API_KEY|PRIVATE_KEY|ACCESS_KEY)[A-Za-z0-9_]*\s*[=:]\s*["']?(?![$<{%])[^\s"']{8,}/i,
    message: "a secret value assigned to a variable",
  },
]

export function findSecrets(text: string | null | undefined): SecretFinding[] {
  if (!text) return []
  return RULES.filter((r) => r.re.test(text)).map(({ kind, message }) => ({ kind, message }))
}

export function looksLikeSecret(text: string | null | undefined): boolean {
  return findSecrets(text).length > 0
}

/** User-facing explanation for a form error. */
export function secretMessage(text: string | null | undefined): string | null {
  const [first] = findSecrets(text)
  if (!first) return null
  return `This looks like it contains ${first.message}. DevWorkspace stores references, not secret values. Use a placeholder like $DATABASE_URL or a vault reference instead.`
}
