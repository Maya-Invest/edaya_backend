import type { Binding } from '../operations/worker-vars.ts'
import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'bun:test'
import { parseVarsCliArgs } from '../cli/parse-vars-cli'
import { planVariableUpdate, updateWorkerVariables, workerTarget } from '../operations/worker-vars.ts'

const initial: Binding[] = [
  { name: 'LOG_LEVEL', type: 'plain_text', text: 'info' },
  { name: 'PHONE_AUTH_MODE', type: 'plain_text', text: 'sms_only' },
  { name: 'UNLISTED', type: 'plain_text', text: 'keep' },
  { name: 'BETTER_AUTH_SECRET', type: 'secret_text' },
  { name: 'HYPERDRIVE', type: 'hyperdrive', id: 'resource' },
  { name: 'BROWSER', type: 'browser' },
]
function fixture(options: { race?: boolean, status?: number, multi?: boolean, pending?: boolean, badReadback?: boolean } = {}) {
  let bindings = structuredClone(initial)
  let writes = 0
  let deploymentReads = 0
  let payload: { bindings: Binding[] } | undefined
  const request = async (url: string | URL | Request, init?: RequestInit) => {
    const path = String(url)
    let result: unknown
    if (path.endsWith('/deployments')) {
      deploymentReads++
      result = { deployments: [{ id: options.race && deploymentReads > 1 ? 'changed' : 'deployment', versions: options.multi ? [] : [{ version_id: 'version', percentage: 100 }] }] }
    }
    else if (path.endsWith('/versions')) {
      result = { items: [{ id: options.pending ? 'pending' : 'version' }] }
    }
    else if (init?.method === 'PATCH') {
      writes++
      expect(init.body).toBeInstanceOf(FormData)
      payload = JSON.parse(String((init.body as FormData).get('settings')))
      if (!options.badReadback)
        bindings = payload!.bindings.map(b => b.type === 'inherit' ? bindings.find(old => old.name === b.name)! : b)
      result = {}
    }
    else {
      result = { bindings }
    }
    return Response.json({ success: !options.status, result }, { status: options.status ?? 200 })
  }
  return { request: request as typeof fetch, writes: () => writes, payload: () => payload }
}
const credentials = { accountId: 'a'.repeat(32), token: 'private-token', worker: 'edaya-api-staging' }

describe('deployed variable updates', () => {
  test('CLI requires explicit target and supports repeatable migration opt-in', () => {
    expect(parseVarsCliArgs(['push', 'production', '--dry-run', '--replace-secret', 'R2_ENDPOINT', '--replace-secret', 'ACCOUNT_SECURITY_KEY_VERSION'])).toMatchObject({ target: 'production', dryRun: true, replaceSecrets: ['R2_ENDPOINT', 'ACCOUNT_SECURITY_KEY_VERSION'] })
    expect(() => parseVarsCliArgs(['push', 'local'])).toThrow()
    expect(() => parseVarsCliArgs(['delete', 'staging'])).toThrow()
    expect(workerTarget('production')).toBe('edaya-api-prod')
  })
  test('updates and adds variables while inheriting secrets, unlisted vars and resources', async () => {
    const f = fixture()
    const result = await updateWorkerVariables({ ...credentials, values: { LOG_LEVEL: 'debug', PHONE_AUTH_MODE: 'disabled' }, request: f.request })
    expect(result.applied).toBe(true)
    expect(f.writes()).toBe(1)
    expect(f.payload()?.bindings).toContainEqual({ name: 'BETTER_AUTH_SECRET', type: 'inherit', version_id: 'latest' })
    expect(f.payload()?.bindings).toContainEqual({ name: 'HYPERDRIVE', type: 'inherit', version_id: 'latest' })
    expect(f.payload()?.bindings).toContainEqual({ name: 'UNLISTED', type: 'inherit', version_id: 'latest' })
    expect(JSON.stringify(f.payload())).not.toContain('private-token')
  })
  test('dry-run and no-op updates do not write', async () => {
    for (const [values, dryRun] of [[{ LOG_LEVEL: 'debug' }, true], [{ LOG_LEVEL: 'info' }, false]] as const) {
      const f = fixture()
      expect((await updateWorkerVariables({ ...credentials, values, dryRun, request: f.request })).applied).toBe(false)
      expect(f.writes()).toBe(0)
    }
  })
  test('deletes only explicitly named plain variables', async () => {
    const f = fixture()
    expect((await updateWorkerVariables({ ...credentials, deletes: ['UNLISTED'], request: f.request })).applied).toBe(true)
    expect(f.payload()?.bindings.some(b => b.name === 'UNLISTED')).toBe(false)
    expect(() => planVariableUpdate(initial, {}, ['BETTER_AUTH_SECRET'])).toThrow('non-secret')
    expect(() => planVariableUpdate(initial, {}, ['HYPERDRIVE'])).toThrow('non-secret')
  })
  test('secret conversion is explicit and restricted to classified configuration', () => {
    const legacy = [{ name: 'R2_ENDPOINT', type: 'secret_text' }]
    const values = { R2_ENDPOINT: 'https://example.com' }
    expect(() => planVariableUpdate(legacy, values)).toThrow('collides')
    expect(planVariableUpdate(legacy, values, [], ['R2_ENDPOINT']).bindings).toEqual([{ name: 'R2_ENDPOINT', type: 'plain_text', text: 'https://example.com' }])
    expect(() => planVariableUpdate(initial, { BETTER_AUTH_SECRET: 'oops' }, [], ['BETTER_AUTH_SECRET'])).toThrow()
    expect(() => planVariableUpdate([{ name: 'LOG_LEVEL', type: 'kv_namespace' }], { LOG_LEVEL: 'debug' })).toThrow('collides')
  })
  test('aborts on races, pending versions, split deployments, and API failures', async () => {
    for (const option of [{ race: true }, { pending: true }, { multi: true }, { status: 403 }, { status: 404 }]) {
      const f = fixture(option)
      await expect(updateWorkerVariables({ ...credentials, values: { LOG_LEVEL: 'debug' }, request: f.request })).rejects.toThrow()
      expect(f.writes()).toBe(0)
    }
    const f = fixture({ badReadback: true })
    await expect(updateWorkerVariables({ ...credentials, values: { LOG_LEVEL: 'debug' }, request: f.request })).rejects.toThrow('read-back')
  })
  test('code deploys preserve vars and staging no longer overrides phone mode', () => {
    const wrangler = JSON.parse(readFileSync(new URL('../../../apps/api/wrangler.jsonc', import.meta.url), 'utf8'))
    expect(wrangler.keep_vars).toBe(true)
    for (const env of Object.values(wrangler.env)) expect(env).not.toHaveProperty('vars')
    const release = readFileSync(new URL('../ops/release.ts', import.meta.url), 'utf8')
    expect(release).not.toContain('PHONE_AUTH_MODE:disabled')
    expect(release).toContain('--keep-vars')
  })
})

test('pause transitions preserve unrelated variables and secrets', async () => {
  const f = fixture()
  await updateWorkerVariables({ ...credentials, values: { PAUSE_API: 'true', PAUSE_SCHEDULER: '1', PAUSE_JOBS: 'true' }, request: f.request })
  expect(f.payload()?.bindings).toContainEqual({ name: 'LOG_LEVEL', type: 'inherit', version_id: 'latest' })
  expect(f.payload()?.bindings).toContainEqual({ name: 'PHONE_AUTH_MODE', type: 'inherit', version_id: 'latest' })
  expect(f.payload()?.bindings).toContainEqual({ name: 'BETTER_AUTH_SECRET', type: 'inherit', version_id: 'latest' })
  for (const legacy of ['STAGING_NOTIFICATION_EMAILS', 'STAGING_MAINTENANCE', 'STAGING_PAUSE_JOBS']) {
    expect(() => planVariableUpdate([], { [legacy]: 'false' })).toThrow('unknown or secret key')
  }
})

test('publishes serialized SMS routes and verifies their read-back', async () => {
  const f = fixture()
  const routes = JSON.stringify([{ prefix: '+225', provider: 'africas_talking' }])
  expect((await updateWorkerVariables({ ...credentials, values: { SMS_ROUTES: routes }, request: f.request })).applied).toBe(true)
  expect(f.payload()?.bindings).toContainEqual({ name: 'SMS_ROUTES', type: 'plain_text', text: routes })
  expect(() => planVariableUpdate(initial, { SMS_ROUTES: 'not JSON' })).toThrow()
  expect(() => planVariableUpdate(initial, { PHONE_SMS_ROUTES: routes })).toThrow(/removed/)
})
