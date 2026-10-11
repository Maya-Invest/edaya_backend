import type { Binding } from '../operations/worker-vars.ts'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'bun:test'
import { parseOperationsCli } from '../cli/parse-operations-cli'
import { resolveIdentityMigrationTarget } from '../db/identity/lib/resolve-migration-target'
import { flattenMigrations } from '../db/school/lib/flatten-migrations'
import { operateSecrets } from '../operations/secrets'
import { formatWorkerStatus } from '../operations/status'

function remote(initial: Binding[] = [], options: { pending?: boolean, split?: boolean, status?: number } = {}) {
  let bindings = initial
  let reads = 0
  const request = (async (input: string | URL | Request) => {
    reads++
    const url = String(input)
    const result = url.endsWith('/deployments') ? { deployments: [{ id: 'd', versions: options.split ? [] : [{ version_id: 'v', percentage: 100 }] }] } : url.endsWith('/versions') ? { items: [{ id: options.pending ? 'pending' : 'v' }] } : { bindings }
    return Response.json({ success: !options.status, result }, { status: options.status ?? 200 })
  }) as typeof fetch
  const credentials = { worker: 'worker', token: 'private-token', accountId: 'a'.repeat(32), request }
  const calls: { args: string[], input: string }[] = []
  const run = async (args: string[], input: string) => {
    calls.push({ args, input })
    for (const [name, value] of Object.entries(JSON.parse(input))) {
      bindings = bindings.filter(b => b.name !== name)
      if (value !== null)
        bindings.push({ name, type: 'secret_text' })
    }
    return 0
  }
  return { credentials, calls, run, reads: () => reads }
}
test('secret previews validate locally; uploads put values in stdin, never args/results', async () => {
  const root = mkdtempSync(join(tmpdir(), 'repo-secrets-'))
  try {
    writeFileSync(join(root, 'secrets.prod.json'), JSON.stringify({ BETTER_AUTH_SECRET: 'sensitive-value' }))
    const f = remote()
    const parsed = parseOperationsCli('secrets', ['push', 'production', '--dry-run'])
    expect(await operateSecrets(parsed, f.credentials, f.run, root)).toEqual({ names: ['BETTER_AUTH_SECRET'], applied: false })
    expect(f.reads()).toBe(0)
    const result = await operateSecrets({ ...parsed, dryRun: false }, f.credentials, f.run, root)
    expect(f.calls[0].args).toEqual(['secret', 'bulk', '--env', 'prod', '--name', 'worker'])
    expect(f.calls[0].input).toContain('sensitive-value')
    expect(JSON.stringify([result, f.calls[0].args])).not.toContain('sensitive-value')
    writeFileSync(join(root, 'secrets.prod.json'), '{"PHONE_AUTH_MODE":"disabled"}')
    await expect(operateSecrets(parsed, f.credentials, f.run, root)).rejects.toThrow('non-secret')
  }
  finally { rmSync(root, { recursive: true, force: true }) }
})
test('secret delete refuses variables; deletion/list expose only secret names', async () => {
  const parsed = parseOperationsCli('secrets', ['delete', 'staging', 'LEGACY'])
  const variable = remote([{ name: 'LEGACY', type: 'plain_text', text: 'private' }])
  await expect(operateSecrets(parsed, variable.credentials, variable.run)).rejects.toThrow('not a secret')
  expect(variable.calls).toHaveLength(0)
  const secret = remote([{ name: 'LEGACY', type: 'secret_text' }])
  expect((await operateSecrets(parsed, secret.credentials, secret.run)).applied).toBe(true)
  expect(secret.calls[0].input).toBe('{"LEGACY":null}')
})
test('status redacts arbitrary settings and invalid control values', () => {
  const status = formatWorkerStatus('worker', { deployments: { deployments: [] }, versions: { items: [] }, bindings: [
    { name: 'PAUSE_API', type: 'plain_text', text: 'private-value' },
    { name: 'BETTER_AUTH_SECRET', type: 'secret_text', text: 'secret-value' },
    { name: 'OTHER', type: 'plain_text', text: 'other-private' },
  ] })
  expect(status).toContain('PAUSE_API: invalid binding/value')
  expect(status).not.toContain('private')
  expect(status).not.toContain('secret-value')
})
test('flatten preserves originals on generation/validation failure and retains backup on success', async () => {
  const root = mkdtempSync(join(tmpdir(), 'repo-flatten-'))
  const directory = join(root, 'drizzle')
  mkdirSync(directory)
  writeFileSync(join(directory, 'old.sql'), 'original')
  try {
    await expect(flattenMigrations(directory, async () => {
      throw new Error('generator failed')
    })).rejects.toThrow()
    expect(readFileSync(join(directory, 'old.sql'), 'utf8')).toBe('original')
    await expect(flattenMigrations(directory, async (output) => {
      mkdirSync(output)
    })).rejects.toThrow()
    expect(readFileSync(join(directory, 'old.sql'), 'utf8')).toBe('original')
    const backup = await flattenMigrations(directory, async (output) => {
      mkdirSync(join(output, 'meta'), { recursive: true })
      writeFileSync(join(output, '0000_base.sql'), 'CREATE TABLE example (id int);')
      writeFileSync(join(output, 'meta/_journal.json'), '{"entries":[{"tag":"0000_base"}]}')
    })
    expect(readFileSync(join(backup, 'old.sql'), 'utf8')).toBe('original')
    expect(readFileSync(join(directory, '0000_base.sql'), 'utf8')).toContain('CREATE TABLE')
  }
  finally { rmSync(root, { recursive: true, force: true }) }
})
test('identity migrations select only the requested target and reject ambiguous legacy input', () => {
  const source = { AUTH_DATABASE_URL: 'postgres://local/db', STAGING_AUTH_DATABASE_URL: 'postgres://staging/db', PRODUCTION_AUTH_DATABASE_URL: 'postgres://production/db' }
  expect(resolveIdentityMigrationTarget(['staging'], source, '/unused').databaseUrl).toBe(source.STAGING_AUTH_DATABASE_URL)
  expect(resolveIdentityMigrationTarget(['production'], source, '/unused').databaseUrl).toBe(source.PRODUCTION_AUTH_DATABASE_URL)
  expect(() => resolveIdentityMigrationTarget([], source, '/unused')).toThrow('Usage:')
  expect(() => resolveIdentityMigrationTarget(['production'], { AUTH_DATABASE_URL: source.AUTH_DATABASE_URL }, '/unused')).toThrow('Missing')
  expect(() => resolveIdentityMigrationTarget(['production', '--dry-run'], source, '/unused')).toThrow()
})

test('secret mutations fail closed on deployment/API errors and failed verification', async () => {
  const parsed = parseOperationsCli('secrets', ['delete', 'staging', 'LEGACY'])
  for (const options of [{ pending: true }, { split: true }, { status: 403 }, { status: 404 }]) {
    const f = remote([{ name: 'LEGACY', type: 'secret_text' }], options)
    await expect(operateSecrets(parsed, f.credentials, f.run)).rejects.toThrow()
    expect(f.calls).toHaveLength(0)
  }
  const f = remote([{ name: 'LEGACY', type: 'secret_text' }])
  await expect(operateSecrets(parsed, { ...f.credentials, token: '' }, f.run)).rejects.toThrow('CLOUDFLARE_API_TOKEN')
  await expect(operateSecrets(parsed, f.credentials, async () => 1)).rejects.toThrow('Wrangler secret update failed')
  await expect(operateSecrets(parsed, f.credentials, async () => 0)).rejects.toThrow('verification failed')
  const missing = remote()
  expect(await operateSecrets(parsed, missing.credentials, missing.run)).toEqual({ names: [], applied: false })
  expect(missing.calls).toHaveLength(0)
})
