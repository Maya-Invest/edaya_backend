import process from 'node:process'
import { loadSeedEnvFiles, parseSeedCliArgs } from '@edaya/seeding/cli'
import { loadConfiguration, readConfig } from '../../../../apps/api/configuration/index.mjs'
import { localOperations } from '../../../../apps/api/configuration/local-operations.mjs'
import { beginStagingSeed, withSeedPause } from '../../operations/seed'
import { workerTarget } from '../../operations/worker-vars.mjs'
import { paths, repoRoot } from '../lib/paths'

export async function dispatchSeedCommand(args: readonly string[]): Promise<number> {
  let interrupted = false
  let child: ReturnType<typeof Bun.spawn> | undefined
  const stop = () => {
    interrupted = true
    child?.kill('SIGTERM')
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  let target = 'local'
  try {
    const parsed = parseSeedCliArgs(['bun', 'seed', ...args])
    if (parsed.kind === 'help')
      return 0
    target = parsed.target
    loadSeedEnvFiles()
    const source = loadConfiguration('local', { source: process.env })
    let scope: string | undefined
    let rootId: string | undefined
    if (target === 'local' && parsed.kind === 'seed' && !parsed.clean) {
      const url = new URL(process.env.SEED_API_URL || source.API_ORIGIN!)
      if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
        throw new Error('Local seeding requires an HTTP loopback API')
      const response = await fetch(new URL('/auth/edaya/testing/capabilities', url), { headers: { origin: process.env.SEED_APP_ORIGIN || 'http://localhost:5173' }, signal: AbortSignal.timeout(10000) })
      const capabilities = response.ok ? await response.json() as { operationsScope?: string, operationsRootId?: string } : undefined
      scope = capabilities?.operationsScope
      rootId = capabilities?.operationsRootId
      if (!scope || !/^[a-f0-9]{64}$/.test(scope))
        throw new Error('Start the current bun repo dev server before seeding; operational scope was not advertised')
    }
    if (target === 'staging' && new URL(process.env.SEED_STAGING_API_URL || readConfig('staging').API_ORIGIN!).origin !== new URL(readConfig('staging').API_ORIGIN!).origin)
      throw new Error('Staging seed URL must match the configured staging Worker')
    const operations = localOperations(target === 'local' ? source : { ...source, API_ORIGIN: 'https://staging.api.edayaplus.com', DATABASE_URL: 'staging', AUTH_DATABASE_URL: 'staging' }, repoRoot, scope)
    if (scope && rootId !== operations.rootId)
      throw new Error('Local seed and API must share LOCAL_OPERATIONS_ROOT')
    const begin = async () => {
      const local = await operations.beginSeed()
      if (target === 'local')
        return local
      try {
        const remote = await beginStagingSeed({ worker: workerTarget('staging'), accountId: process.env.CLOUDFLARE_ACCOUNT_ID, token: process.env.CLOUDFLARE_API_TOKEN })
        return { drain: remote.drain, async finish(success: boolean) {
          try {
            await remote.finish(success)
          }
          finally { await local.finish(success) }
        } }
      }
      catch (error) {
        await local.finish(false)
        throw error
      }
    }
    const code = await withSeedPause(begin, async () => {
      if (interrupted)
        return 130
      const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^CLOUDFLARE_(?:API_TOKEN|ACCOUNT_ID|API_KEY|EMAIL)$/.test(key)))
      env.EDAYA_SEED_SUPERVISED = '1'
      child = Bun.spawn(['bun', '--no-env-file', paths.seed, ...args], { cwd: repoRoot, env, stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' })
      const result = await child.exited
      return interrupted ? 130 : result
    })
    if (code !== 0)
      console.error(`Seeding failed; background processing remains paused. Inspect bun repo status ${target} before resuming scheduler and jobs.`)
    return code
  }
  catch (error) {
    console.error(error instanceof Error ? error.message : 'Seeding failed')
    console.error(`Inspect bun repo status ${target}; after resolving the failure, resume scheduler and jobs explicitly${target === 'staging' ? ' and resume Cloudflare queue delivery' : ''}.`)
    return 1
  }
  finally {
    process.removeListener('SIGINT', stop)
    process.removeListener('SIGTERM', stop)
  }
}
