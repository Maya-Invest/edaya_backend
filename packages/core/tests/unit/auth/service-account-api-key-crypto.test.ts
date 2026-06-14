import { describe, expect, test } from 'bun:test'
import {
  API_KEY_PREFIX,
  generateApiKey,
  hashApiKey,
  parseBearerApiKey,
} from '../../../src/authorization'

describe('api key crypto', () => {
  test('generateApiKey returns prefixed key and stable hash', () => {
    const generated = generateApiKey()

    expect(generated.plaintext.startsWith(API_KEY_PREFIX)).toBe(true)
    expect(generated.prefix.length).toBeGreaterThan(API_KEY_PREFIX.length)
    expect(generated.hash).toBe(hashApiKey(generated.plaintext))
  })

  test('parseBearerApiKey extracts bearer token', () => {
    expect(parseBearerApiKey('Bearer sk_live_abc123')).toBe('sk_live_abc123')
    expect(parseBearerApiKey('Basic abc')).toBeUndefined()
    expect(parseBearerApiKey(undefined)).toBeUndefined()
  })
})
