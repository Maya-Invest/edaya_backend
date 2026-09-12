import {
  API_KEY_PREFIX,
  encodeApiKey,
  encodeS2sApiKey,
  generateApiKey,
  generateS2sApiKey,
  hashApiKey,
  parseBearerApiKey,
  parseBearerS2sKey,
  S2S_API_KEY_PREFIX,
} from '@edaya/authorization'
import { describe, expect, test } from 'bun:test'

describe('api key crypto', () => {
  test('generateApiKey returns prefixed key and stable hash', () => {
    const generated = generateApiKey()

    expect(generated.plaintext.startsWith(API_KEY_PREFIX)).toBe(true)
    expect(generated.prefix.length).toBeGreaterThan(API_KEY_PREFIX.length)
    expect(generated.hash).toBe(hashApiKey(generated.plaintext))
  })

  test('encodeApiKey accepts a known plaintext key', () => {
    const plaintext = `${API_KEY_PREFIX}dev-known-key-for-seeding-tests`
    const encoded = encodeApiKey(plaintext)

    expect(encoded.plaintext).toBe(plaintext)
    expect(encoded.prefix).toBe(plaintext.slice(0, API_KEY_PREFIX.length + 8))
    expect(encoded.hash).toBe(hashApiKey(plaintext))
  })

  test('encodeApiKey rejects invalid keys', () => {
    expect(() => encodeApiKey('invalid')).toThrow(/must start with/)
    expect(() => encodeApiKey(`${API_KEY_PREFIX}short`)).toThrow(/at least 16 characters/)
  })

  test('parseBearerApiKey extracts bearer token', () => {
    expect(parseBearerApiKey('Bearer sk_live_abc12345678901234567890123456789')).toBe('sk_live_abc12345678901234567890123456789')
    expect(parseBearerApiKey(`Bearer edaya_at_${'a'.repeat(43)}`)).toBeUndefined()
    expect(parseBearerApiKey('Bearer sk_live_short')).toBeUndefined()
    expect(parseBearerApiKey('Basic abc')).toBeUndefined()
    expect(parseBearerApiKey(undefined)).toBeUndefined()
  })

  test('s2s keys use a distinct prefix and parser from staff service keys', () => {
    const generated = generateS2sApiKey()
    expect(generated.plaintext.startsWith(S2S_API_KEY_PREFIX)).toBe(true)
    expect(generated.plaintext.startsWith(API_KEY_PREFIX)).toBe(false)
    expect(parseBearerS2sKey(`Bearer ${generated.plaintext}`)).toBe(generated.plaintext)
    expect(parseBearerApiKey(`Bearer ${generated.plaintext}`)).toBeUndefined()

    const staffKey = `${API_KEY_PREFIX}dev-known-key-for-seeding-tests`
    expect(parseBearerS2sKey(`Bearer ${staffKey}`)).toBeUndefined()
    expect(parseBearerApiKey(`Bearer ${staffKey}`)).toBe(staffKey)
    expect(encodeS2sApiKey(`${S2S_API_KEY_PREFIX}dev-known-s2s-key-16`).hash).toBe(
      hashApiKey(`${S2S_API_KEY_PREFIX}dev-known-s2s-key-16`),
    )
  })
})
