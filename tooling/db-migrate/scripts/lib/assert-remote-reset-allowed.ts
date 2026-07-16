/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */
import type { MigrationTarget } from './resolve-migration-target'
import process from 'node:process'

const LOCAL_DATABASE_URLS = new Set(['pglite', 'memory'])

function isLocalDatabaseUrl(databaseUrl: string): boolean {
  const trimmed = databaseUrl.trim()
  return LOCAL_DATABASE_URLS.has(trimmed) || trimmed.startsWith('pglite:')
}

function parseHostname(databaseUrl: string): string {
  try {
    return new URL(databaseUrl.replace(/^postgres(ql)?:\/\//, 'postgres://')).hostname.toLowerCase()
  }
  catch {
    throw new Error('Database URL is not a valid Postgres connection string.')
  }
}

function looksLikeStagingDatabase(databaseUrl: string, hostname: string): boolean {
  return hostname.includes('staging')
    || hostname.includes('-staging')
    || databaseUrl.includes('/staging')
    || databaseUrl.includes('branch=staging')
}

function destructiveOverrideEnabled(): boolean {
  const value = process.env['SEED_ALLOW_DESTRUCTIVE']?.trim().toLowerCase()
  return value === 'true' || value === '1' || value === 'yes'
}

/** Guard destructive remote resets (staging / production Neon). */
export function assertRemoteResetAllowed(
  target: Extract<MigrationTarget, 'staging' | 'production'>,
  databaseUrl: string,
): void {
  const trimmed = databaseUrl.trim()
  if (!trimmed) {
    throw new Error(`${target === 'staging' ? 'STAGING_DATABASE_URL' : 'PRODUCTION_DATABASE_URL'} is required.`)
  }

  if (isLocalDatabaseUrl(trimmed)) {
    throw new Error('Remote reset requires a Postgres connection string. Use `bun repo seed clean` for local `.data`.')
  }

  if (destructiveOverrideEnabled()) {
    return
  }

  const hostname = parseHostname(trimmed)
  const looksLikeStaging = looksLikeStagingDatabase(trimmed, hostname)

  if (target === 'staging' && !looksLikeStaging) {
    throw new Error(
      'Refusing to reset: STAGING_DATABASE_URL does not look like a staging branch. '
      + 'Set SEED_ALLOW_DESTRUCTIVE=true to override.',
    )
  }

  if (target === 'production' && looksLikeStaging) {
    throw new Error(
      'Refusing to reset: PRODUCTION_DATABASE_URL looks like a staging branch. '
      + 'Set SEED_ALLOW_DESTRUCTIVE=true to override.',
    )
  }
}
