import process from 'node:process'
import { loadSeedEnvFiles, parseSeedCliArgs, probeLocalApiReachable, runSeedCleanup } from '@edaya/seeding/cli'
import { loadConfiguration, readConfig } from '../../../../apps/api/configuration/index.ts'
import { localOperations } from '../../../../apps/api/configuration/local-operations.ts'
import { waitForLocalSeedServices } from '../../operations/local-seed-services'
import { beginStagingSeed, withSeedPause } from '../../operations/seed'
import { workerTarget } from '../../operations/worker-vars.ts'
import { redact, run } from '../../ops/runtime'
import { Services } from '../../ops/services'
import { paths, repoRoot } from '../lib/paths'

export async function dispatchSeedCommand(args: readonly string[]): Promise<number> {
  let interrupted = false
  const stop = () => {
    interrupted = true
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  let target = 'local'
  let seedStarted = false
  try {
    const parsed = parseSeedCliArgs(['bun', 'seed', ...args])
    if (parsed.kind === 'help')
      return 0
    target = parsed.target
    loadSeedEnvFiles()
    const source = loadConfiguration('local', { source: process.env })
    if (target === 'local' && (parsed.kind === 'clean' || parsed.clean) && await probeLocalApiReachable(process.env.SEED_API_URL || source.API_ORIGIN!))
      throw new Error('Stop bun repo dev before resetting the local school database; a running API may own open PGlite handles')
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
        throw new Error('Start the current bun run repo dev server before seeding; operational scope was not advertised')
    }
    if (target === 'staging' && new URL(process.env.SEED_STAGING_API_URL || readConfig('staging').API_ORIGIN!).origin !== new URL(readConfig('staging').API_ORIGIN!).origin)
      throw new Error('Staging seed URL must match the configured staging Worker')
    const operations = localOperations(target === 'local' ? source : { ...source, API_ORIGIN: 'https://staging.api.edayaplus.com', DATABASE_URL: 'staging', AUTH_DATABASE_URL: 'staging' }, repoRoot, scope)
    if (scope && rootId !== operations.rootId)
      throw new Error('Local seed and API must share LOCAL_OPERATIONS_ROOT')
    const begin = async () => {
      const local = await operations.beginSeed()
      seedStarted = true
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
      let services: Services | undefined
      try {
        let seedArgs = args
        if (target === 'local' && parsed.kind === 'seed' && parsed.clean) {
          if (!await runSeedCleanup({ target: 'local', yes: parsed.yes ?? false }))
            return 0
          console.log('Starting temporary local API and file services for reset and reseed.')
          services = new Services()
          const serviceEnv = { ...source, LOCAL_OTP_CAPTURE: 'true' }
          // Owned reset services do not watch files: source edits must not
          // interrupt SQL or a persisted upload halfway through seeding.
          services.start('API', ['bun', '--no-env-file', 'src/entries/local.ts'], paths.apiRoot, serviceEnv)
          const filesUrl = source.LOCAL_FILES_URL || `http://localhost:${source.LOCAL_FILES_PORT || '9200'}`
          const filesReady = await fetch(new URL('/health', filesUrl), { signal: AbortSignal.timeout(2000) }).then(response => response.ok, () => false)
          if (!filesReady)
            services.start('Local files', ['bun', '--no-env-file', 'tooling/repo/dev/local-files.ts'], repoRoot, serviceEnv)
          await waitForLocalSeedServices({ apiUrl: source.API_ORIGIN!, filesUrl, appOrigin: process.env.SEED_APP_ORIGIN || 'http://localhost:5173', assertRunning: () => services!.assertRunning() })
          seedArgs = args.filter(arg => !['--clean', '--yes', '-y'].includes(arg))
        }
        await run(['bun', '--no-env-file', paths.seed, ...seedArgs], { cwd: repoRoot, env, inheritEnv: false, inheritInput: true })
        return interrupted ? 130 : 0
      }
      finally { await services?.stop('local-seed-services.json') }
    })
    if (code !== 0)
      console.error(`Seeding failed; background processing remains paused. Inspect bun repo ops status ${target} before resuming scheduler and jobs.`)
    return code
  }
  catch (error) {
    console.error(redact(error instanceof Error ? error.message : 'Seeding failed'))
    if (seedStarted)
      console.error(`Inspect bun repo ops status ${target}; after resolving the failure, resume scheduler and jobs explicitly${target === 'staging' ? ' and resume Cloudflare queue delivery' : ''}.`)
    return 1
  }
  finally {
    process.removeListener('SIGINT', stop)
    process.removeListener('SIGTERM', stop)
  }
}
