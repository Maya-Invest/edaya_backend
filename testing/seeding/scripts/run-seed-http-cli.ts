#!/usr/bin/env bun

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
    serviceAccountApiKey: process.env.SERVICE_ACCOUNT_API_KEY?.trim(),
  }
}

export async function runSeedHttpCli(argv: string[]): Promise<number> {
  const { baseUrl, serviceAccountApiKey } = resolveSeedHttpConfig()

  let scope: HttpDevSeedScope
  try {
    scope = parseHttpDevSeedScope(argv)
  }
  catch (error) {
    console.error(error instanceof Error ? error.message : error)
    return 1
  }

  if (!serviceAccountApiKey && scope !== 'auth' && scope !== 'service-account') {
    console.warn(
      'No SERVICE_ACCOUNT_API_KEY configured. '
      + 'Using director session bootstrap for /core/* seeding. '
      + 'After seed:init, add the printed key to apps/api/.env.',
    )
  }

  const client = new HttpSeedClient({ baseUrl })
  const results = await runHttpDevSeeds({
    client,
    scope,
    ...(serviceAccountApiKey ? { serviceAccountApiKey } : {}),
    provisionServiceAccount: scope === 'all',
  })

  logHttpDevSeedResults(results)

  if (results.smoke?.status === 'failed') {
    return 1
  }

  return 0
}
