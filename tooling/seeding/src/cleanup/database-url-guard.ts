/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */
import process from 'node:process'
import { isStagingSeedApiUrl } from '../support/resolve-seed-env'

const LOCAL_DATABASE_URLS = new Set(['pglite', 'memory'])

export function isLocalDatabaseUrl(databaseUrl: string | undefined): boolean {
  if (!databaseUrl?.trim()) {
    return true
  }

  const trimmed = databaseUrl.trim()
  if (LOCAL_DATABASE_URLS.has(trimmed) || trimmed.startsWith('pglite:')) {
    return true
  }

  return false
}

function isStagingSeedEnvironment(): boolean {
  const configured = process.env['SEED_STAGING_API_URL']?.trim()
  return configured ? isStagingSeedApiUrl(configured) : false
}

/** Block obvious production Neon URLs unless the operator explicitly opts in. */
export function assertStagingSchoolDatabaseUrl(databaseUrl: string): void {
  const trimmed = databaseUrl.trim()
  if (!trimmed) {
    throw new Error('STAGING_DATABASE_URL is required for staging cleanup.')
  }

  if (isLocalDatabaseUrl(trimmed)) {
    throw new Error('Refusing to wipe a local/ephemeral DATABASE_URL. Use `bun repo ops seed clean` for local `.data`.')
  }

  const allowDestructive = process.env['SEED_ALLOW_DESTRUCTIVE']?.trim().toLowerCase()
  if (allowDestructive === 'true' || allowDestructive === '1' || allowDestructive === 'yes') {
    return
  }

  if (isStagingSeedEnvironment()) {
    return
  }

  let hostname = ''
  try {
    hostname = new URL(trimmed.replace(/^postgres(ql)?:\/\//, 'postgres://')).hostname.toLowerCase()
  }
  catch {
    throw new Error('STAGING_DATABASE_URL is not a valid Postgres connection string.')
  }

  const looksLikeStaging = hostname.includes('staging')
    || hostname.includes('-staging')
    || trimmed.includes('/staging')
    || trimmed.includes('branch=staging')

  if (!looksLikeStaging) {
    throw new Error(
      'Refusing to wipe school data: STAGING_DATABASE_URL does not look like a staging branch. '
      + 'Set SEED_ALLOW_DESTRUCTIVE=true to override.',
    )
  }
}
