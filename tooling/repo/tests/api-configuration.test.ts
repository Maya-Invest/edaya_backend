import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'bun:test'
import { loadConfiguration, parseJsonc, readConfig, validateConfig, validateSecrets } from '../../../apps/api/configuration/index.mjs'

const directories: string[] = []
afterEach(() => {
  for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('API configuration ownership', () => {
  test('reads commented string values and rejects malformed JSON, duplicates, and nonstrings', () => {
    expect(validateConfig(parseJsonc('{ // comment\n"PORT": "9999", }'))).toEqual({ PORT: '9999' })
    expect(() => parseJsonc('{"PORT": "1", "PORT": "2"}')).toThrow('duplicate')
    expect(() => parseJsonc('{')).toThrow('valid JSONC')
    expect(() => validateConfig({ PORT: 9999 })).toThrow('string')
    expect(() => validateConfig({ BETTER_AUTH_SECRET: 'private' })).toThrow('secret key')
    expect(() => validateConfig({ GOTENBERG_URL: 'https://user:private@example.com' })).toThrow('without credentials')
  })
  test('secrets reject settings even if already present in process environment', () => {
    const root = mkdtempSync(join(tmpdir(), 'edaya-config-'))
    directories.push(root)
    writeFileSync(join(root, 'config.local.jsonc'), '{"PORT":"9999"}')
    writeFileSync(join(root, '.env'), 'PORT=1234\n')
    expect(() => loadConfiguration('local', { root, source: { PORT: '1234' } })).toThrow('non-secret')
    expect(() => validateSecrets({ DATABASE_URL: 'pglite:.data/school' })).toThrow('config.local')
    expect(() => validateSecrets({ AFRICAS_TALKING_API_KEY: '' })).toThrow('omit unused')
  })
  test('explicit overrides win; secrets stay literal; local never reads Wrangler secrets', () => {
    const root = mkdtempSync(join(tmpdir(), 'edaya-config-'))
    directories.push(root)
    writeFileSync(join(root, 'config.local.jsonc'), '{"PORT":"9999","DATABASE_URL":"pglite:.data/school"}')
    writeFileSync(join(root, 'private.env'), 'BETTER_AUTH_SECRET=literal$DOLLAR\n')
    writeFileSync(join(root, '.dev.vars'), 'R2_SECRET_ACCESS_KEY=foreign\n')
    const result = loadConfiguration('local', { root, source: { PORT: '8888', EDAYA_LOCAL_ENV_FILE: 'private.env' } })
    expect(result.PORT).toBe('8888')
    expect(result.BETTER_AUTH_SECRET).toBe('literal$DOLLAR')
    expect(result.R2_SECRET_ACCESS_KEY).toBeUndefined()
  })
  test('all checked-in profiles are valid and retain their runtime boundaries', () => {
    expect(readConfig('local').RUNTIME).toBe('local')
    for (const target of ['staging', 'production']) {
      const config = readConfig(target)
      expect(config.RUNTIME).toBe('worker')
      expect(config.PHONE_AUTH_MODE).toBe('disabled')
      expect(config.DATABASE_URL).toBeUndefined()
      expect(config.R2_ENDPOINT).toStartWith('https://')
    }
    expect(() => validateConfig({ PORT: '9999' }, 'config', 'staging')).toThrow('local-only')
  })
})
