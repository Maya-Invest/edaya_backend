/* eslint-disable node/prefer-global/process, dot-notation -- test bootstrap reads DATABASE_URL from optional local env */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const LOCAL_ENV_FILE = '.env.test.local'

export interface IntegrationTestConfig {
  /** Duplicate each suite against remote Postgres when true. */
  runRemotePostgres: boolean
  /** Remote Postgres URL (same env name as production API). */
  databaseUrl?: string
}

let cachedConfig: IntegrationTestConfig | undefined

/** Load only DATABASE_URL from the local file — runtime flags stay on the process env. */
function loadLocalDatabaseUrl(): void {
  const filePath = path.resolve(packageRoot, LOCAL_ENV_FILE)
  if (!existsSync(filePath)) {
    return
  }

  const parsed = config({ path: filePath, processEnv: {} })
  const databaseUrl = parsed.parsed?.['DATABASE_URL']?.trim()
  if (databaseUrl) {
    process.env['DATABASE_URL'] = databaseUrl
  }
}

function parseBooleanFlag(value: string | undefined): boolean {
  return value === '1' || value === 'true'
}

function resolveRemoteDatabaseUrl(): string | undefined {
  const databaseUrl = process.env['DATABASE_URL']
  if (!databaseUrl || databaseUrl === 'pglite' || databaseUrl === 'memory') {
    return undefined
  }

  return databaseUrl
}

function buildConfig(): IntegrationTestConfig {
  const databaseUrl = resolveRemoteDatabaseUrl()
  const runRemotePostgres = parseBooleanFlag(process.env['RUN_POSTGRES_REMOTE']) && Boolean(databaseUrl)

  return {
    runRemotePostgres,
    ...(databaseUrl ? { databaseUrl } : {}),
  }
}

/** Parsed once per test process. Optional `.env.test.local` supplies `DATABASE_URL` only. */
export function getIntegrationTestConfig(): IntegrationTestConfig {
  if (!cachedConfig) {
    loadLocalDatabaseUrl()
    cachedConfig = buildConfig()
  }

  return cachedConfig
}
