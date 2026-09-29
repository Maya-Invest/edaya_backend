import { Buffer } from 'node:buffer'
import { expect, test } from 'bun:test'
import { base32, createAccountSecurity, totpCode } from './security'

test('RFC 6238 SHA1 vector and replay guard', async () => {
  const secret = base32(new TextEncoder().encode('12345678901234567890'))
  expect(totpCode(secret, 1)).toBe('287082')
  const adapter = createAccountSecurity({ v1: Buffer.alloc(32, 1).toString('base64') }, 'v1')
  expect(await adapter.verifyTotp(secret, '287082', 59000)).toBe(1)
  expect(await adapter.verifyTotp(secret, '287082', 59000, 1)).toBeNull()
})
test('encryption retains old key versions and rejects tampering', async () => {
  const keys = { v1: Buffer.alloc(32, 1).toString('base64'), v2: Buffer.alloc(32, 2).toString('base64') }
  const first = createAccountSecurity(keys, 'v1')
  const second = createAccountSecurity(keys, 'v2')
  const encrypted = await first.encrypt('secret')
  expect(encrypted).not.toContain('secret')
  expect(await second.decrypt(encrypted)).toBe('secret')
  await expect(second.decrypt(`${encrypted.slice(0, -3)}AAA`)).rejects.toThrow()
})
