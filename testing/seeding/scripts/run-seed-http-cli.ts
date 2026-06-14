import type { HttpDevSeedScope } from '../src/http/index.ts'
import process from 'node:process'
import {

  HttpSeedClient,
  logHttpDevSeedResults,
  parseHttpDevSeedScope,
  runHttpDevSeeds,
} from '../src/http/index.ts'
import { loadSeedEnvFiles } from '../src/load-seed-env.ts'

export function resolveSeedHttpConfig() {
  loadSeedEnvFiles()
  return {
    baseUrl: process.env.SEED_API_URL ?? process.env.BETTER_AUTH_URL ?? 'http://localhost:9999',
    systemActorSecret: process.env.SYSTEM_ACTOR_SECRET?.trim(),
  }
}

export async function runSeedHttpCli(argv: string[]): Promise<number> {
  const { baseUrl, systemActorSecret } = resolveSeedHttpConfig()

  let scope: HttpDevSeedScope
  try {
    scope = parseHttpDevSeedScope(argv)
  }
  catch (error) {
    console.error(error instanceof Error ? error.message : error)
    return 1
  }

  if (scope !== 'auth' && !systemActorSecret) {
    console.error(`Scope "${scope}" requires SYSTEM_ACTOR_SECRET (must match the running API).`)
    console.error('Auth-only seed: bun seed:auth')
    console.error('Full seed: set SYSTEM_ACTOR_SECRET in apps/api/.env, then bun seed or bun seed:init')
    return 1
  }

  const client = new HttpSeedClient({ baseUrl })
  const results = await runHttpDevSeeds({
    client,
    scope,
    systemActorSecret,
  })

  logHttpDevSeedResults(results)

  if (results.smoke?.status === 'failed') {
    return 1
  }

  return 0
}
