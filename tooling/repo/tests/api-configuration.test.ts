import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'bun:test'
import { loadConfiguration, parseJsonc, readConfig, validateConfig, validateSecrets, validateSmsCredentials } from '../../../apps/api/configuration/index.ts'

const directories: string[] = []
afterEach(() => {
  for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('API configuration ownership', () => {
  test('rejects retired GraphQL settings and development credentials', () => {
    for (const key of ['ENABLE_GRAPHQL', 'GRAPHQL_GRAPHIQL', 'GRAPHIQL_WEBAPP_ORIGIN', 'GRAPHIQL_DEFAULT_EMAIL'])
      expect(() => validateConfig({ [key]: 'true' })).toThrow()
    expect(() => validateSecrets({ GRAPHQL_DEV_API_KEY: 'retired-key' })).toThrow('unknown')
  })
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

describe('SMS route configuration', () => {
  test('release preflight requires credentials only for enabled delivery', () => {
    expect(() => validateSmsCredentials({})).not.toThrow()
    const config = {
      SMS_TRANSPORT: 'router',
      SMS_ROUTES: JSON.stringify([{ prefix: '+225', provider: 'africas_talking' }]),
      AFRICAS_TALKING_USERNAME: 'live-app',
      AFRICAS_TALKING_SENDER_ID: 'EDAYA',
      AFRICAS_TALKING_API_KEY: 'test-key',
    }
    expect(() => validateSmsCredentials(config)).not.toThrow()
    for (const sender of [undefined, '', '  ']) {
      const { AFRICAS_TALKING_SENDER_ID: _configuredSender, ...withoutSender } = config
      const values = sender === undefined ? withoutSender : { ...withoutSender, AFRICAS_TALKING_SENDER_ID: sender }
      expect(() => validateSmsCredentials(values)).not.toThrow()
      expect(() => validateSmsCredentials({ ...values, AFRICAS_TALKING_SANDBOX: 'true', AFRICAS_TALKING_USERNAME: 'sandbox' })).not.toThrow()
    }
    expect(() => validateSmsCredentials({ ...config, SMS_ROUTES: '[]' })).toThrow('sms_routes')
    expect(() => validateSmsCredentials({ ...config, AFRICAS_TALKING_API_KEY: '' })).toThrow('AFRICAS_TALKING_API_KEY')
    expect(() => validateSmsCredentials({ ...config, AFRICAS_TALKING_USERNAME: '' })).toThrow('AFRICAS_TALKING_USERNAME')
    expect(() => validateSmsCredentials({ ...config, AFRICAS_TALKING_SANDBOX: 'true' })).toThrow('sandbox')
    expect(() => validateSmsCredentials({ ...config, AFRICAS_TALKING_SANDBOX: 'true', AFRICAS_TALKING_USERNAME: 'sandbox' })).not.toThrow()
  })
  test('native routes become runtime strings and cannot be overridden by inherited values', () => {
    const root = mkdtempSync(join(tmpdir(), 'edaya-sms-config-'))
    directories.push(root)
    const routes = [{ prefix: '+225', provider: 'africas_talking' }]
    writeFileSync(join(root, 'config.local.jsonc'), JSON.stringify({ sms_routes: routes }))
    expect(readConfig('local', root)).toEqual({ SMS_ROUTES: JSON.stringify(routes) })
    expect(loadConfiguration('local', { root, source: { SMS_ROUTES: '[]', sms_routes: '[]' } }).SMS_ROUTES).toBe(JSON.stringify(routes))
    expect(() => loadConfiguration('local', { root, source: { PHONE_SMS_ROUTES: '[]' } })).toThrow(/removed/)
  })
  test('rejects escaped JSON, duplicate prefixes, unregistered providers and legacy fields', () => {
    const route = { prefix: '+225', provider: 'africas_talking' }
    for (const sms_routes of ['[]', [route, route], [{ ...route, provider: 'unknown' }], [{ ...route, prefix: '225' }], [{ ...route, secret: 'invalid' }]])
      expect(() => validateConfig({ sms_routes })).toThrow()
    expect(() => validateConfig({ PHONE_SMS_ROUTES: '[]' })).toThrow(/removed/)
    expect(() => validateConfig({ SMS_ROUTES: '[]' })).toThrow(/native/)
    expect(() => validateSecrets({ SMS_ROUTES: '[]' })).toThrow(/non-secret/)
    expect(() => validateConfig({ AFRICAS_TALKING_SANDBOX: 'true' }, 'staging', 'staging')).toThrow(/live SMS/)
  })
  test('environment selection preserves native route isolation', () => {
    const root = mkdtempSync(join(tmpdir(), 'edaya-sms-config-'))
    directories.push(root)
    for (const [target, prefix] of [['local', '+225'], ['staging', '+22507'], ['production', '+22505']]) {
      writeFileSync(join(root, `config.${target}.jsonc`), JSON.stringify({ sms_routes: [{ prefix, provider: 'africas_talking' }] }))
      expect(JSON.parse(readConfig(target!, root).SMS_ROUTES!)[0].prefix).toBe(prefix)
    }
  })
})
