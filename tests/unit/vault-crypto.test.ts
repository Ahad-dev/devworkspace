import { describe, expect, it } from "vitest"

import {
  createVault,
  decryptItem,
  encryptItem,
  formatRecoveryKey,
  fromBase64,
  generatePassword,
  MAX_ITEM_BYTES,
  parseRecoveryKey,
  toBase64,
  unlockWithPassword,
  unlockWithRecoveryKey,
  validateVaultRecord,
  VaultError,
  wrapWithNewRecoveryKey,
  wrapWithPassword,
  type VaultKeyRecord,
} from "@/features/vault/crypto"

/** The vault's cryptography (Plan P11.2; docs/SECURITY.md §8). Real WebCrypto, Node's. */
const OWNER = "11111111-1111-4111-8111-111111111111"
const IDS = {
  secretId: "22222222-2222-4222-8222-222222222222",
  accountId: "33333333-3333-4333-8333-333333333333",
}
const PASSWORD = "correct horse battery staple"

const code = async (p: Promise<unknown>) => {
  try {
    await p
  } catch (e) {
    return e instanceof VaultError ? e.code : `unexpected: ${String(e)}`
  }
  return "no error"
}

function flip(b64: string, index = 0) {
  const bytes = fromBase64(b64)
  bytes[index] = bytes[index]! ^ 0x01
  return toBase64(bytes)
}

describe("vault keys", () => {
  it("creates a vault that the master password and the recovery key both open", async () => {
    const { record, recoveryKey, sessionKey } = await createVault(OWNER, PASSWORD)
    expect(() => validateVaultRecord(record)).not.toThrow()

    const sealed = await encryptItem(sessionKey, IDS, "s3cr3t-value")
    const byPassword = await unlockWithPassword(OWNER, record, PASSWORD)
    const byRecovery = await unlockWithRecoveryKey(OWNER, record, recoveryKey)
    expect(await decryptItem(byPassword, IDS, sealed)).toBe("s3cr3t-value")
    expect(await decryptItem(byRecovery, IDS, sealed)).toBe("s3cr3t-value")
  })

  it("never hands out the key itself after unlock", async () => {
    const { sessionKey } = await createVault(OWNER, PASSWORD)
    expect(sessionKey.extractable).toBe(false)
    await expect(crypto.subtle.exportKey("raw", sessionKey)).rejects.toThrow()
  })

  it("refuses a wrong password, another owner's record and a wrong recovery key", async () => {
    const { record, recoveryKey } = await createVault(OWNER, PASSWORD)
    expect(await code(unlockWithPassword(OWNER, record, "wrong horse battery staple"))).toBe(
      "wrong_password",
    )
    expect(
      await code(unlockWithPassword("44444444-4444-4444-8444-444444444444", record, PASSWORD)),
    ).toBe("wrong_password")
    const other = (await createVault(OWNER, PASSWORD)).recoveryKey
    expect(await code(unlockWithRecoveryKey(OWNER, record, other))).toBe("wrong_recovery_key")
    expect(recoveryKey).not.toBe(other)
  })

  it("rejects a short master password", async () => {
    expect(await code(createVault(OWNER, "short"))).toBe("wrong_password")
  })

  it("rejects stored settings that weaken or corrupt the key derivation", async () => {
    const { record } = await createVault(OWNER, PASSWORD)
    const weakened: VaultKeyRecord = { ...record, kdf_iterations: 1000 }
    expect(() => validateVaultRecord(weakened)).toThrow(VaultError)
    expect(await code(unlockWithPassword(OWNER, weakened, PASSWORD))).toBe("invalid_record")
    expect(() => validateVaultRecord({ ...record, kdf_salt: "AAAA" })).toThrow(VaultError)
    expect(
      await code(
        unlockWithPassword(
          OWNER,
          { ...record, master_wrapped_key: flip(record.master_wrapped_key) },
          PASSWORD,
        ),
      ),
    ).toBe("wrong_password")
  })

  it("changes the master password and the recovery key without touching items", async () => {
    const { record, sessionKey } = await createVault(OWNER, PASSWORD)
    const sealed = await encryptItem(sessionKey, IDS, "keep me")

    const extractable = await unlockWithPassword(OWNER, record, PASSWORD, { extractable: true })
    const newMaster = await wrapWithPassword(OWNER, extractable, "a brand new master password")
    const newRecovery = await wrapWithNewRecoveryKey(OWNER, extractable)
    const updated: VaultKeyRecord = { ...record, ...newMaster, ...newRecovery.fields }

    expect(await code(unlockWithPassword(OWNER, updated, PASSWORD))).toBe("wrong_password")
    const k1 = await unlockWithPassword(OWNER, updated, "a brand new master password")
    const k2 = await unlockWithRecoveryKey(OWNER, updated, newRecovery.recoveryKey)
    expect(await decryptItem(k1, IDS, sealed)).toBe("keep me")
    expect(await decryptItem(k2, IDS, sealed)).toBe("keep me")
  })
})

describe("items", () => {
  it("round-trips text, including non-ASCII and multi-line values", async () => {
    const { sessionKey } = await createVault(OWNER, PASSWORD)
    for (const value of [
      "",
      "p@ss",
      "héllo wörld ✓",
      "line 1\nline 2\n",
      "x".repeat(MAX_ITEM_BYTES),
    ]) {
      expect(await decryptItem(sessionKey, IDS, await encryptItem(sessionKey, IDS, value))).toBe(
        value,
      )
    }
  })

  it("hides the exact length: values of similar size give the same ciphertext size", async () => {
    const { sessionKey } = await createVault(OWNER, PASSWORD)
    const a = await encryptItem(sessionKey, IDS, "abc")
    const b = await encryptItem(sessionKey, IDS, "a much longer value!")
    expect(a.ciphertext.length).toBe(b.ciphertext.length)
  })

  it("refuses tampering and values moved to another item or account", async () => {
    const { sessionKey } = await createVault(OWNER, PASSWORD)
    const sealed = await encryptItem(sessionKey, IDS, "value")
    expect(
      await code(decryptItem(sessionKey, IDS, { ...sealed, ciphertext: flip(sealed.ciphertext) })),
    ).toBe("corrupt")
    expect(await code(decryptItem(sessionKey, IDS, { ...sealed, iv: flip(sealed.iv) }))).toBe(
      "corrupt",
    )
    const tagFlipped = flip(sealed.ciphertext, fromBase64(sealed.ciphertext).length - 1)
    expect(await code(decryptItem(sessionKey, IDS, { ...sealed, ciphertext: tagFlipped }))).toBe(
      "corrupt",
    )
    expect(
      await code(
        decryptItem(
          sessionKey,
          { ...IDS, accountId: "55555555-5555-4555-8555-555555555555" },
          sealed,
        ),
      ),
    ).toBe("corrupt")
    expect(
      await code(
        decryptItem(
          sessionKey,
          { ...IDS, secretId: "66666666-6666-4666-8666-666666666666" },
          sealed,
        ),
      ),
    ).toBe("corrupt")
  })

  it("refuses values over the size limit", async () => {
    const { sessionKey } = await createVault(OWNER, PASSWORD)
    expect(await code(encryptItem(sessionKey, IDS, "x".repeat(MAX_ITEM_BYTES + 1)))).toBe(
      "too_large",
    )
  })

  it("uses a fresh IV every time", async () => {
    const { sessionKey } = await createVault(OWNER, PASSWORD)
    const ivs = new Set<string>()
    for (let i = 0; i < 1000; i++) ivs.add((await encryptItem(sessionKey, IDS, "same")).iv)
    expect(ivs.size).toBe(1000)
  })
})

describe("recovery key format", () => {
  const secret = new Uint8Array(32).map((_, i) => (i * 37 + 11) & 0xff)

  it("round-trips, ignoring case, spaces, dashes and look-alike letters", () => {
    const text = formatRecoveryKey(secret)
    expect(text).toMatch(/^[0-9A-Z]{6}(-[0-9A-Z]{1,6})+$/)
    expect(parseRecoveryKey(text)).toEqual(secret)
    const sloppy = text.toLowerCase().replaceAll("-", " ").replaceAll("0", "o").replaceAll("1", "l")
    expect(parseRecoveryKey(sloppy)).toEqual(secret)
  })

  it("catches a typo and an incomplete key", () => {
    const text = formatRecoveryKey(secret)
    const swapped = text[0] === "A" ? `B${text.slice(1)}` : `A${text.slice(1)}`
    expect(() => parseRecoveryKey(swapped)).toThrow(VaultError)
    expect(() => parseRecoveryKey(text.slice(0, -3))).toThrow(VaultError)
  })
})

describe("generatePassword", () => {
  it("makes passwords of the asked length from the allowed characters", () => {
    const passwords = Array.from({ length: 200 }, () => generatePassword(24))
    for (const p of passwords) expect(p).toMatch(/^[a-km-zA-HJ-NP-Z2-9!@#$%^&*\-_=+?]{24}$/)
    expect(new Set(passwords).size).toBe(200)
    expect(generatePassword(16, { symbols: false })).toMatch(/^[a-km-zA-HJ-NP-Z2-9]{16}$/)
  })
})
