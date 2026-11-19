import { describe, expect, it } from "vitest"

import { findSecrets, looksLikeSecret, secretMessage } from "@/lib/security/secret-guard"

describe("secret-guard", () => {
  it.each([
    ["credential URL", "postgres://admin:hunter2@db.example.com:5432/app"],
    ["token in URL userinfo", "https://ghp_abcdefghijklmnopqrstuvwxyz0123@github.com/o/r"],
    ["token in query string", "https://api.example.com/v1?access_token=abcdef123456"],
    ["private key", "-----BEGIN OPENSSH PRIVATE KEY-----\nabc"],
    [
      "JWT",
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
    ],
    ["GitHub token", "my token is ghp_1234567890abcdefghijklmnopqrstuvwx"],
    ["Stripe live key", "sk_live_51HxYzAbCdEfGh"],
    ["Supabase secret key", "sb_secret_abc123def456"],
    ["AWS access key id", "AKIAIOSFODNN7EXAMPLE"],
    ["literal secret assignment", "DATABASE_PASSWORD=correct-horse-battery"],
    ["api key assignment", "api_key: 9f8e7d6c5b4a3210"],
  ])("flags %s", (_label, text) => {
    expect(looksLikeSecret(text)).toBe(true)
    expect(secretMessage(text)).toMatch(/stores references, not secret values/)
  })

  it.each([
    ["plain prose", "Deploys from main every Friday after QA."],
    ["placeholder variable", "DATABASE_URL=$DATABASE_URL"],
    ["templated placeholder", "API_KEY=<your key here>"],
    ["variable name only", "Requires STRIPE_SECRET_KEY to be configured in Infisical."],
    ["normal URL", "https://github.com/acme/web/pull/42?tab=files"],
    ["ssh remote", "git@github.com:acme/api.git"],
    ["empty", ""],
  ])("leaves %s alone", (_label, text) => {
    expect(findSecrets(text)).toEqual([])
    expect(secretMessage(text)).toBeNull()
  })

  it("handles null and undefined", () => {
    expect(looksLikeSecret(null)).toBe(false)
    expect(looksLikeSecret(undefined)).toBe(false)
  })
})
