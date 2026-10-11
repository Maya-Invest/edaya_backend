import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { parseJsonc, readConfig, validateSecrets } from '../../../apps/api/configuration/index'
import { stagingDatabaseTarget } from '../db/lib/staging-validation'
import { beginStagingSeed } from '../operations/seed'
import { readWorkerState, updateWorkerVariables, workerTarget } from '../operations/worker-vars'
import { root, run, waitForUrl, writeJson } from './runtime'

interface WorkerConfig {
  env: {
    staging: {
      kv_namespaces: {
        binding: string
        id: string
      }[]
      hyperdrive: {
        binding: string
        id: string
      }[]
      queues: {
        producers: {
          binding: string
          queue: string
        }[]
      }
    }
  }
}
export function identitySecrets(value: string | undefined): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(value ?? '')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.values(parsed).some(value => typeof value !== 'string' || !value.trim()))
      throw new Error('Invalid identity secrets')
    const secrets = parsed as Record<string, string>
    validateSecrets(secrets, 'STAGING_IDENTITY_SECRETS')
    if (!secrets.BETTER_AUTH_SECRET || secrets.BETTER_AUTH_SECRET.length < 32)
      throw new Error('Invalid identity secrets')
    return secrets
  }
  catch {
    throw new Error('Missing or invalid STAGING_IDENTITY_SECRETS')
  }
}
type Cloud = <T>(path: string, body?: unknown, method?: string) => Promise<T>
/** Called only after owned API/queue pause and drain. Restart pagination after deleting. */
export async function purgeStaging(cloud: Cloud, queueId: string, namespaceId: string): Promise<void> {
  await cloud(`/queues/${queueId}/purge`, { delete_messages_permanently: true }, 'POST')
  for (;;) {
    const keys = await cloud<{
      name: string
    }[]>(`/storage/kv/namespaces/${namespaceId}/keys?limit=1000`)
    if (!keys.length)
      return
    await cloud(`/storage/kv/namespaces/${namespaceId}/bulk`, keys.map(key => key.name), 'DELETE')
  }
}
export function maintenanceOptions(args: string[]): {
  recover: boolean
  dryRun: boolean
} {
  if (args[0] !== 'staging' || args.slice(1).some(arg => !['--yes', '--dry-run', '--recover'].includes(arg)))
    throw new Error('Expected staging [--yes] [--dry-run] [--recover]')
  const dryRun = args.includes('--dry-run')
  if (!dryRun && !args.includes('--yes'))
    throw new Error('Staging reset/reseed or recovery requires explicit --yes')
  return { recover: args.includes('--recover'), dryRun }
}
export async function maintenance(args: string[]): Promise<void> {
  const options = maintenanceOptions(args)
  const credentials = { worker: workerTarget('staging'), accountId: process.env.CLOUDFLARE_ACCOUNT_ID, token: process.env.CLOUDFLARE_API_TOKEN }
  const env = { ...process.env, RELEASE_TARGET: 'staging', RESET_DATA: 'true', STAGING_MAINTENANCE_CONFIRMED: 'true' }
  const school = stagingDatabaseTarget('school', env)
  const identity = stagingDatabaseTarget('identity', env)
  const secrets = options.recover ? {} : identitySecrets(process.env.STAGING_IDENTITY_SECRETS)
  const configuration = (parseJsonc(readFileSync(resolve(root, 'apps/api/wrangler.jsonc'), 'utf8')) as unknown as WorkerConfig).env.staging
  async function cloud<T>(path: string, body?: unknown, method = body ? 'PUT' : 'GET'): Promise<T> {
    if (!credentials.accountId || !credentials.token)
      throw new Error('Missing Cloudflare maintenance credentials')
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${credentials.accountId}${path}`, { method, headers: { 'Authorization': `Bearer ${credentials.token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) })
    const data = await response.json() as {
      success: boolean
      result: unknown
    }
    if (!response.ok || !data.success)
      throw new Error('Maintenance resource verification failed')
    return data.result as T
  }
  const namespace = configuration.kv_namespaces.find(item => item.binding === 'AUTH_KV')?.id
  const name = configuration.queues.producers.find(item => item.binding === 'CRON_JOBS')?.queue
  const queues = await cloud<{
    queue_name: string
    queue_id: string
    settings: Record<string, unknown>
  }[]>('/queues?per_page=100')
  const queue = queues.find(item => item.queue_name === name)
  if (!namespace || !queue)
    throw new Error('Missing staging authentication namespace or queue')
  await cloud(`/storage/kv/namespaces/${namespace}/keys?limit=1`)
  await run(['bun', '--no-env-file', 'tooling/repo/db/school/staging-preflight.ts'], { env, timeout: 30000 })
  for (const [name, target] of [['HYPERDRIVE', school], ['HYPERDRIVE_AUTH', identity]] as const) {
    const binding = configuration.hyperdrive.find(item => item.binding === name)
    if (!binding)
      throw new Error('Missing staging database binding')
    const deployed = await cloud<{
      origin: {
        host: string
        database: string
        user: string
      }
      caching: {
        disabled: boolean
      }
    }>(`/hyperdrive/configs/${binding.id}`)
    if (deployed.origin?.host !== target.hostname || deployed.origin.database !== decodeURIComponent(target.pathname.slice(1)) || deployed.origin.user !== decodeURIComponent(target.username) || deployed.caching?.disabled !== true)
      throw new Error('Database target differs from deployed staging binding')
  }
  const evidence = { sourceCommit: await run(['git', 'rev-parse', 'HEAD'], { quiet: true }), environment: 'staging', operation: options.recover ? 'recover' : 'reset-reseed', status: 'validated', dryRun: options.dryRun }
  const save = () => writeJson(resolve(root, '.ci-evidence/maintenance.json'), evidence)
  save()
  if (options.dryRun)
    return
  try {
    if (options.recover) {
      const state = await readWorkerState(credentials)
      if (!queue || queue.settings.delivery_paused !== true || ['PAUSE_API', 'PAUSE_JOBS', 'PAUSE_SCHEDULER'].some(name => state.bindings.find(binding => binding.name === name)?.text !== 'true'))
        throw new Error('Recovery requires all controls and queue delivery to remain paused; inspect staging first')
      await cloud(`/queues/${queue.queue_id}`, { queue_name: name, settings: { ...queue.settings, delivery_paused: false } })
      try {
        await updateWorkerVariables({ ...credentials, values: { PAUSE_API: 'false', PAUSE_JOBS: 'false', PAUSE_SCHEDULER: 'false' } })
      }
      catch (error) {
        await cloud(`/queues/${queue.queue_id}`, { queue_name: name, settings: queue.settings })
        throw error
      }
    }
    else {
      const session = await beginStagingSeed(credentials, { maintenance: true })
      const directory = mkdtempSync(resolve(tmpdir(), 'edaya-staging-maintenance-'))
      let success = false
      try {
        await session.drain()
        const response = await fetch(`${readConfig('staging').API_ORIGIN}/reference`, { signal: AbortSignal.timeout(10000) })
        if (response.status !== 503)
          throw new Error('Staging API did not enter maintenance')
        await purgeStaging(cloud, queue.queue_id, namespace)
        for (const slice of ['identity', 'school'])
          await run(['bun', '--no-env-file', `tooling/repo/db/${slice}/staging-release.ts`], { env })
        const accounts = resolve(directory, 'accounts.json')
        const sessions = resolve(directory, 'sessions.json')
        await run(['bun', '--no-env-file', 'tooling/seeding/scripts/export-identity-fixtures.ts', accounts], { env: { SEED_DATASET: 'demo-ci' } })
        await run(['bun', '--no-env-file', 'apps/api/src/identity/entries/staging-fixtures.ts', 'staging', accounts, sessions], { env: { ...env, ...readConfig('staging'), ...secrets } })
        await session.openApi!()
        await waitForUrl(`${readConfig('staging').API_ORIGIN}/reference`)
        await run(['bun', '--no-env-file', 'tooling/seeding/scripts/seed.ts', '--staging', '--skip-profile-photos', '--skip-attachments'], { env: { CLOUDFLARE_API_TOKEN: undefined, CLOUDFLARE_ACCOUNT_ID: undefined, EDAYA_SEED_SUPERVISED: '1', NODE_ENV: 'production', SEED_DATASET: 'demo-ci', SEED_AUTH_SESSIONS_FILE: sessions } })
        success = true
      }
      finally {
        try {
          await session.finish(success)
        }
        finally {
          rmSync(directory, { recursive: true, force: true })
        }
      }
    }
    evidence.status = 'completed'
  }
  catch (error) {
    evidence.status = 'failed-controls-require-inspection'
    throw error
  }
  finally {
    save()
  }
}
