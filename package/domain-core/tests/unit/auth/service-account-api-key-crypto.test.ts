import { describe, expect, test } from 'bun:test'
import {
  API_KEY_PREFIX,
  encodeApiKey,
  generateApiKey,
  hashApiKey,
  parseBearerApiKey,
} from '../../../src/capabilities/authorization'

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
    expect(parseBearerApiKey('Bearer sk_live_abc123')).toBe('sk_live_abc123')
    expect(parseBearerApiKey('Basic abc')).toBeUndefined()
    expect(parseBearerApiKey(undefined)).toBeUndefined()
  })
})
