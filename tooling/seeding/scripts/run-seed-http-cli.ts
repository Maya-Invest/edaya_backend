#!/usr/bin/env bun
/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */

import type { HttpDevSeedScope } from '../src/http/index.ts'
import process from 'node:process'
import { resolveSeedingApiKeyForSchool, SEED_SCHOOL_ID } from '@edaya/fixtures'
import {
  HttpSeedClient,
  logHttpDevSeedResults,
  parseHttpDevSeedScope,
  runHttpDevSeeds,
} from '../src/http/index.ts'
import { waitForApi } from '../src/http/wait-for-api.ts'
import { loadSeedEnvFiles } from '../src/support/load-seed-env.ts'

const DEFAULT_LOCAL_APP_ORIGIN = 'http://localhost:5173'
const DEFAULT_STAGING_APP_ORIGIN = 'https://app-staging.edaya.softilab.dev'

function resolveAppOrigin(baseUrl: string): string {
  const explicit = process.env['SEED_APP_ORIGIN']?.trim()
  if (explicit) {
    return explicit.replace(/\/+$/, '')
  }

  if (baseUrl.includes('api-staging.')) {
    return (
      process.env['STAGING_APP_ORIGIN']?.trim().replace(/\/+$/, '')
      || DEFAULT_STAGING_APP_ORIGIN
    )
  }

  return DEFAULT_LOCAL_APP_ORIGIN
}

export function resolveSeedHttpConfig() {
  loadSeedEnvFiles()
  const baseUrl = process.env['SEED_API_URL'] ?? process.env['BETTER_AUTH_URL'] ?? 'http://localhost:9999'
  const schoolId = process.env['SEED_SCHOOL_ID']?.trim() || SEED_SCHOOL_ID
  return {
    baseUrl,
    appOrigin: resolveAppOrigin(baseUrl),
    schoolId,
    serviceAccountApiKey: resolveSeedingApiKeyForSchool(schoolId),
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

  const client = new HttpSeedClient({ baseUrl, appOrigin })

  if (scope !== 'auth') {
    console.log(`Waiting for API at ${baseUrl}...`)
    await waitForApi(baseUrl)
  }

  const results = await runHttpDevSeeds({
    client,
    scope,
    serviceAccountApiKey,
    provisionServiceAccount: scope === 'all',
  })

  logHttpDevSeedResults(results)

  if (results.smoke?.status === 'failed' || results.validation?.status === 'failed') {
    return 1
  }

  return 0
}
