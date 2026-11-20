import type { AccountSecurityPort } from '@edaya/account'
import { Buffer } from 'node:buffer'
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
export function base32(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let result = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      result += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits)
    result += ALPHABET[(value << (5 - bits)) & 31]
  return result
}
function decode32(secret: string): Uint8Array {
  let bits = 0
  let value = 0
  const result: number[] = []
  for (const char of secret) {
    const index = ALPHABET.indexOf(char)
    if (index < 0)
      throw new Error('Invalid authenticator secret')
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      result.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Uint8Array.from(result)
}
export function totpCode(secret: string, step: number): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const digest = createHmac('sha1', decode32(secret)).update(counter).digest()
  const offset = digest[digest.length - 1]! & 15
  return String((digest.readUInt32BE(offset) & 0x7FFFFFFF) % 1000000).padStart(6, '0')
}
export function createAccountSecurity(keys: Record<string, string>, activeVersion: string): AccountSecurityPort {
  const active = keys[activeVersion]
  if (!active || Buffer.from(active, 'base64').length !== 32)
    throw new Error('A 32-byte Account encryption key is required')
  async function key(version: string) {
    const raw = keys[version]
    if (!raw || Buffer.from(raw, 'base64').length !== 32)
      throw new Error('Account encryption key is unavailable')
    return crypto.subtle.importKey('raw', Buffer.from(raw, 'base64'), 'AES-GCM', false, ['encrypt', 'decrypt'])
  }
  return {
    token: () => randomBytes(32).toString('base64url'),
    digest: async value => createHash('sha256').update(value).digest('hex'),
    newSecret: () => base32(randomBytes(20)),
    async encrypt(secret) {
      const iv = randomBytes(12)
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(`edaya:totp:${activeVersion}`) }, await key(activeVersion), new TextEncoder().encode(secret))
      return `${activeVersion}.${iv.toString('base64url')}.${Buffer.from(ciphertext).toString('base64url')}`
    },
    async decrypt(ciphertext) {
      const [version, nonce, encrypted] = ciphertext.split('.')
      if (!version || !nonce || !encrypted)
        throw new Error('Invalid encrypted authenticator')
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(nonce, 'base64url'), additionalData: new TextEncoder().encode(`edaya:totp:${version}`) }, await key(version), Buffer.from(encrypted, 'base64url'))
      return new TextDecoder().decode(plain)
    },
    async verifyTotp(secret, code, now, lastStep) {
      if (!/^\d{6}$/.test(code))
        return null
      const current = Math.floor(now / 30000)
      for (const step of [current, current - 1, current + 1]) {
        if (step < 0 || (lastStep !== undefined && step <= lastStep))
          continue
        if (timingSafeEqual(Buffer.from(code), Buffer.from(totpCode(secret, step))))
          return step
      }
      return null
    },
  }
}
