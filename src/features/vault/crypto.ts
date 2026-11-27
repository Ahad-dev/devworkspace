/**
 * The Accounts vault's cryptography (Plan P11.2; docs/SECURITY.md §8). WebCrypto only, no
 * dependency; runs in the browser (and in Node for tests). Nothing here talks to the server: callers
 * store only what these functions return, which is always ciphertext, IVs, salts or wrapped keys.
 *
 * - A random 256-bit AES-GCM **vault key** encrypts every item.
 * - It is stored wrapped twice: by a key derived from the **master password** (PBKDF2-SHA256,
 *   600,000 iterations) and by a key derived from the random **recovery key** (HKDF-SHA256).
 * - Every wrap and item has associated data naming what it is, so a ciphertext moved to another
 *   row, account or owner fails to decrypt.
 * - After unlock the vault key is non-extractable: page code can use it, but can't read it out.
 */

export const VAULT_FORMAT = 1
export const KDF_ITERATIONS = 600_000
export const MIN_KDF_ITERATIONS = 600_000
export const MAX_KDF_ITERATIONS = 5_000_000
export const MIN_MASTER_PASSWORD_LENGTH = 12
/** Largest value an item can hold, in bytes of UTF-8. */
export const MAX_ITEM_BYTES = 16 * 1024

const PAD_BLOCK = 32
const encoder = new TextEncoder()
const decoder = new TextDecoder("utf-8", { fatal: true })

export type VaultErrorCode =
  | "wrong_password"
  | "wrong_recovery_key"
  | "invalid_recovery_key"
  | "invalid_record"
  | "too_large"
  | "corrupt"

export class VaultError extends Error {
  readonly code: VaultErrorCode
  constructor(code: VaultErrorCode, message: string) {
    super(message)
    this.name = "VaultError"
    this.code = code
  }
}

/** What vault_keys stores, column for column. */
export type VaultKeyRecord = {
  kdf_iterations: number
  kdf_salt: string
  master_wrapped_key: string
  master_wrap_iv: string
  recovery_salt: string
  recovery_wrapped_key: string
  recovery_wrap_iv: string
}

export type ItemIds = { secretId: string; accountId: string }
export type SealedItem = { ciphertext: string; iv: string }

/* Bytes and base64 ------------------------------------------------------------------------------- */

function subtle() {
  const s = globalThis.crypto?.subtle
  if (!s) throw new Error("This browser can't run the vault (WebCrypto is missing).")
  return s
}

function randomBytes(n: number) {
  return globalThis.crypto.getRandomValues(new Uint8Array(new ArrayBuffer(n)))
}

export function toBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  if (text.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(text)) {
    throw new VaultError("corrupt", "Stored vault data is malformed.")
  }
  const binary = atob(text)
  const out = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

function decodeExact(text: string, bytes: number) {
  const out = fromBase64(text)
  if (out.length !== bytes)
    throw new VaultError("invalid_record", "Stored vault data is malformed.")
  return out
}

/* Associated data ---------------------------------------------------------------------------------- */

const keyAad = (kind: "master" | "recovery", ownerId: string) =>
  encoder.encode(`dw:vault-key:v${VAULT_FORMAT}:${kind}:${ownerId}`)
const itemAad = ({ secretId, accountId }: ItemIds) =>
  encoder.encode(`dw:item:v${VAULT_FORMAT}:${secretId}:${accountId}`)

/* Key derivation ----------------------------------------------------------------------------------- */

async function masterKek(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const base = await subtle().importKey(
    "raw",
    encoder.encode(password.normalize("NFKC")),
    "PBKDF2",
    false,
    ["deriveKey"],
  )
  return subtle().deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey"],
  )
}

async function recoveryKek(recovery: Uint8Array<ArrayBuffer>, salt: Uint8Array<ArrayBuffer>) {
  const base = await subtle().importKey("raw", recovery, "HKDF", false, ["deriveKey"])
  return subtle().deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt,
      info: encoder.encode(`dw:vault:recovery:v${VAULT_FORMAT}`),
    },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey"],
  )
}

async function wrap(key: CryptoKey, kek: CryptoKey, aad: Uint8Array<ArrayBuffer>) {
  const iv = randomBytes(12)
  const wrapped = await subtle().wrapKey("raw", key, kek, {
    name: "AES-GCM",
    iv,
    additionalData: aad,
  })
  return { wrapped: toBase64(new Uint8Array(wrapped)), iv: toBase64(iv) }
}

async function unwrap(
  wrapped: Uint8Array<ArrayBuffer>,
  iv: Uint8Array<ArrayBuffer>,
  kek: CryptoKey,
  aad: Uint8Array<ArrayBuffer>,
  extractable: boolean,
) {
  return subtle().unwrapKey(
    "raw",
    wrapped,
    kek,
    { name: "AES-GCM", iv, additionalData: aad },
    { name: "AES-GCM", length: 256 },
    extractable,
    ["encrypt", "decrypt"],
  )
}

/** Refuses stored settings this version didn't write, including a weakened key derivation. */
export function validateVaultRecord(record: VaultKeyRecord) {
  const it = record.kdf_iterations
  if (!Number.isInteger(it) || it < MIN_KDF_ITERATIONS || it > MAX_KDF_ITERATIONS) {
    throw new VaultError("invalid_record", "The vault's key settings aren't safe to use.")
  }
  decodeExact(record.kdf_salt, 16)
  decodeExact(record.master_wrapped_key, 48)
  decodeExact(record.master_wrap_iv, 12)
  decodeExact(record.recovery_salt, 16)
  decodeExact(record.recovery_wrapped_key, 48)
  decodeExact(record.recovery_wrap_iv, 12)
}

/* Vault lifecycle -------------------------------------------------------------------------------- */

/**
 * Creates a vault: a new vault key wrapped by the master password and by a fresh recovery key.
 * Returns the record to store, the recovery key to show once, and the unlocked session key.
 */
export async function createVault(ownerId: string, masterPassword: string) {
  assertMasterPassword(masterPassword)
  const vaultKey = await subtle().generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ])
  const master = await wrapWithPassword(ownerId, vaultKey, masterPassword)
  const recovery = await wrapWithNewRecoveryKey(ownerId, vaultKey)
  const record: VaultKeyRecord = { ...master, ...recovery.fields }
  const sessionKey = await unlockWithPassword(ownerId, record, masterPassword)
  return { record, recoveryKey: recovery.recoveryKey, sessionKey }
}

export function assertMasterPassword(password: string) {
  if (password.normalize("NFKC").length < MIN_MASTER_PASSWORD_LENGTH) {
    throw new VaultError(
      "wrong_password",
      `Use at least ${MIN_MASTER_PASSWORD_LENGTH} characters for the master password.`,
    )
  }
}

/** The master-password half of a record (used at setup and when the password changes). */
export async function wrapWithPassword(
  ownerId: string,
  extractableKey: CryptoKey,
  password: string,
) {
  assertMasterPassword(password)
  const salt = randomBytes(16)
  const kek = await masterKek(password, salt, KDF_ITERATIONS)
  const { wrapped, iv } = await wrap(extractableKey, kek, keyAad("master", ownerId))
  return {
    kdf_iterations: KDF_ITERATIONS,
    kdf_salt: toBase64(salt),
    master_wrapped_key: wrapped,
    master_wrap_iv: iv,
  }
}

/** A new recovery key and the record fields it unlocks (setup, or "new recovery key"). */
export async function wrapWithNewRecoveryKey(ownerId: string, extractableKey: CryptoKey) {
  const secret = randomBytes(32)
  const salt = randomBytes(16)
  const kek = await recoveryKek(secret, salt)
  const { wrapped, iv } = await wrap(extractableKey, kek, keyAad("recovery", ownerId))
  return {
    recoveryKey: formatRecoveryKey(secret),
    fields: { recovery_salt: toBase64(salt), recovery_wrapped_key: wrapped, recovery_wrap_iv: iv },
  }
}

/**
 * Unlocks with the master password. The key is non-extractable unless asked for (only to re-wrap
 * it when the password or recovery key changes, and only inside that one operation).
 */
export async function unlockWithPassword(
  ownerId: string,
  record: VaultKeyRecord,
  password: string,
  { extractable = false }: { extractable?: boolean } = {},
) {
  validateVaultRecord(record)
  const kek = await masterKek(password, fromBase64(record.kdf_salt), record.kdf_iterations)
  try {
    return await unwrap(
      fromBase64(record.master_wrapped_key),
      fromBase64(record.master_wrap_iv),
      kek,
      keyAad("master", ownerId),
      extractable,
    )
  } catch {
    throw new VaultError("wrong_password", "That master password doesn't open the vault.")
  }
}

export async function unlockWithRecoveryKey(
  ownerId: string,
  record: VaultKeyRecord,
  recoveryKey: string,
  { extractable = false }: { extractable?: boolean } = {},
) {
  validateVaultRecord(record)
  const secret = parseRecoveryKey(recoveryKey)
  const kek = await recoveryKek(secret, fromBase64(record.recovery_salt))
  try {
    return await unwrap(
      fromBase64(record.recovery_wrapped_key),
      fromBase64(record.recovery_wrap_iv),
      kek,
      keyAad("recovery", ownerId),
      extractable,
    )
  } catch {
    throw new VaultError("wrong_recovery_key", "That recovery key doesn't open the vault.")
  }
}

/* Items ---------------------------------------------------------------------------------------------- */

/** ISO/IEC 7816-4 padding to a multiple of 32 bytes, so a value's exact length isn't visible. */
function pad(bytes: Uint8Array) {
  const total = Math.ceil((bytes.length + 1) / PAD_BLOCK) * PAD_BLOCK
  const out = new Uint8Array(new ArrayBuffer(total))
  out.set(bytes)
  out[bytes.length] = 0x80
  return out
}

function unpad(bytes: Uint8Array) {
  let i = bytes.length - 1
  while (i >= 0 && bytes[i] === 0) i--
  if (i < 0 || bytes[i] !== 0x80) throw new VaultError("corrupt", "A stored value is damaged.")
  return bytes.subarray(0, i)
}

export async function encryptItem(
  key: CryptoKey,
  ids: ItemIds,
  value: string,
): Promise<SealedItem> {
  const bytes = encoder.encode(value)
  if (bytes.length > MAX_ITEM_BYTES) {
    throw new VaultError("too_large", "That value is too long to store (16 KB at most).")
  }
  const iv = randomBytes(12)
  const ciphertext = await subtle().encrypt(
    { name: "AES-GCM", iv, additionalData: itemAad(ids) },
    key,
    pad(bytes),
  )
  return { ciphertext: toBase64(new Uint8Array(ciphertext)), iv: toBase64(iv) }
}

export async function decryptItem(key: CryptoKey, ids: ItemIds, sealed: SealedItem) {
  const iv = decodeExact(sealed.iv, 12)
  let plain: ArrayBuffer
  try {
    plain = await subtle().decrypt(
      { name: "AES-GCM", iv, additionalData: itemAad(ids) },
      key,
      fromBase64(sealed.ciphertext),
    )
  } catch {
    throw new VaultError("corrupt", "A stored value is damaged or belongs elsewhere.")
  }
  try {
    return decoder.decode(unpad(new Uint8Array(plain)))
  } catch (e) {
    if (e instanceof VaultError) throw e
    throw new VaultError("corrupt", "A stored value is damaged.")
  }
}

/* Recovery key format: Crockford base32, a 10-bit checksum, groups of six ------------------------------ */

const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
const RECOVERY_CHARS = 52 // 256 bits
const CHECK_CHARS = 2

function checksum(bytes: Uint8Array) {
  let sum = 0
  for (let i = 0; i < bytes.length; i++) sum = (sum + bytes[i]! * (i + 1)) % 1021
  return sum
}

export function formatRecoveryKey(secret: Uint8Array) {
  if (secret.length !== 32) throw new Error("A recovery key is 32 bytes.")
  let bits = 0
  let value = 0
  let out = ""
  for (const byte of secret) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
    value &= (1 << bits) - 1 // keep only the bits not yet written
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  const sum = checksum(secret)
  out += B32[(sum >>> 5) & 31]! + B32[sum & 31]!
  return out.match(/.{1,6}/g)!.join("-")
}

export function parseRecoveryKey(text: string): Uint8Array<ArrayBuffer> {
  const clean = text.toUpperCase().replace(/[\s-]/g, "").replace(/[IL]/g, "1").replace(/O/g, "0")
  if (clean.length !== RECOVERY_CHARS + CHECK_CHARS || [...clean].some((c) => !B32.includes(c))) {
    throw new VaultError("invalid_recovery_key", "That isn't a complete recovery key.")
  }
  const out = new Uint8Array(new ArrayBuffer(32))
  let bits = 0
  let value = 0
  let n = 0
  for (const c of clean.slice(0, RECOVERY_CHARS)) {
    value = ((value << 5) | B32.indexOf(c)) & 0xfff
    bits += 5
    if (bits >= 8) {
      out[n++] = (value >>> (bits - 8)) & 0xff
      bits -= 8
    }
  }
  const sum = B32.indexOf(clean[RECOVERY_CHARS]!) * 32 + B32.indexOf(clean[RECOVERY_CHARS + 1]!)
  if (n !== 32 || sum !== checksum(out)) {
    throw new VaultError("invalid_recovery_key", "That recovery key has a typo.")
  }
  return out
}

/* Password generator --------------------------------------------------------------------------------- */

const LOWER = "abcdefghijkmnopqrstuvwxyz"
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"
const DIGITS = "23456789"
const SYMBOLS = "!@#$%^&*-_=+?"

/** A random password without look-alike characters, by rejection sampling (no modulo bias). */
export function generatePassword(length = 20, { symbols = true }: { symbols?: boolean } = {}) {
  const alphabet = LOWER + UPPER + DIGITS + (symbols ? SYMBOLS : "")
  const limit = 256 - (256 % alphabet.length)
  let out = ""
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte < limit && out.length < length) out += alphabet[byte % alphabet.length]
    }
  }
  return out
}
