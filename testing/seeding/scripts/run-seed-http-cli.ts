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

const DEFAULT_LOCAL_APP_ORIGIN = 'http://localhost:5173'
const DEFAULT_STAGING_APP_ORIGIN = 'https://app-staging.edaya.softilab.dev'

function resolveAppOrigin(baseUrl: string): string {
  const explicit = process.env.SEED_APP_ORIGIN?.trim()
  if (explicit) {
    return explicit.replace(/\/+$/, '')
  }

  if (baseUrl.includes('api-staging.')) {
    return (
      process.env.STAGING_APP_ORIGIN?.trim().replace(/\/+$/, '')
      || DEFAULT_STAGING_APP_ORIGIN
    )
  }

  return DEFAULT_LOCAL_APP_ORIGIN
}

export function resolveSeedHttpConfig() {
  loadSeedEnvFiles()
  const baseUrl = process.env.SEED_API_URL ?? process.env.BETTER_AUTH_URL ?? 'http://localhost:9999'
  return {
    baseUrl,
    appOrigin: resolveAppOrigin(baseUrl),
    serviceAccountApiKey: process.env.SERVICE_ACCOUNT_API_KEY?.trim(),
  }
}

export async function runSeedHttpCli(argv: string[]): Promise<number> {
  const { baseUrl, appOrigin, serviceAccountApiKey } = resolveSeedHttpConfig()

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

  const client = new HttpSeedClient({ baseUrl, appOrigin })
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
