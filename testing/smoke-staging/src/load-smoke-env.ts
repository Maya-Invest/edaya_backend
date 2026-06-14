/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { expand } from 'dotenv-expand'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(packageRoot, '../..')

const DEFAULT_STAGING_API_URL = 'https://api-staging.edaya.softilab.dev'
const DEFAULT_STAGING_APP_ORIGIN = 'https://app-staging.edaya.softilab.dev'

export interface SmokeStagingEnv {
  apiUrl: string
  appOrigin: string
  staffEmail: string
  staffPassword: string
  serviceAccountApiKey?: string
}

export function loadSmokeStagingEnv(options?: { loadEnvFile?: boolean }): SmokeStagingEnv {
  const loadEnvFile = options?.loadEnvFile ?? process.env['SMOKE_STAGING_LOAD_ENV_FILE'] !== '0'
  const stagingEnvPath = path.join(repoRoot, 'testing/seeding/.env.staging')
  if (loadEnvFile && existsSync(stagingEnvPath)) {
    expand(config({ path: stagingEnvPath }))
  }

  const apiUrl = (
    process.env['STAGING_API_URL']
    ?? process.env['SEED_API_URL']
    ?? DEFAULT_STAGING_API_URL
  ).replace(/\/+$/, '')

  const appOrigin = (
    process.env['STAGING_APP_ORIGIN']
    ?? DEFAULT_STAGING_APP_ORIGIN
  ).replace(/\/+$/, '')

  const serviceAccountApiKey = process.env['SERVICE_ACCOUNT_API_KEY']?.trim()

  return {
    apiUrl,
    appOrigin,
    staffEmail: process.env['SMOKE_STAFF_EMAIL']?.trim() ?? '',
    staffPassword: process.env['SMOKE_STAFF_PASSWORD']?.trim() ?? '',
    ...(serviceAccountApiKey ? { serviceAccountApiKey } : {}),
  }
}
