import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { isPgliteDatabase } from '@edaya/adaptor-postgres'
import { config } from 'dotenv'
import { expand } from 'dotenv-expand'

/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */
export type MigrationTarget = 'local' | 'staging' | 'production'
export type MigrationScope = 'full' | 'school' | 'auth'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const repoRoot = path.resolve(packageRoot, '../..')

function loadApiEnvFile(): void {
  const envPath = path.resolve(repoRoot, 'apps/api/.env')
  if (existsSync(envPath)) {
    expand(config({ path: envPath }))
  }
}

function loadRepoEnvFile(): void {
  const rootEnv = path.resolve(repoRoot, '.env')
  const legacySeedingEnv = path.resolve(repoRoot, 'tooling/seeding/.env')

  if (existsSync(rootEnv)) {
    expand(config({ path: rootEnv }))
    return
  }

  if (existsSync(legacySeedingEnv)) {
    expand(config({ path: legacySeedingEnv }))
  }
}

function resolveLocalDatabaseUrl(databaseUrl: string): string {
  if (!databaseUrl.startsWith('pglite:') && !databaseUrl.startsWith('file://')) {
    return databaseUrl
  }

  const prefix = databaseUrl.startsWith('file://') ? 'file://' : 'pglite:'
  const dataDir = databaseUrl.slice(prefix.length).trim()

  if (!dataDir || path.isAbsolute(dataDir)) {
    return databaseUrl
  }

  if (dataDir === '.data' || dataDir.startsWith('.data/')) {
    return `${prefix}${path.resolve(repoRoot, dataDir)}`
  }

  return databaseUrl
}

function fail(message: string, hints: string[] = []): never {
  console.error(message)
  for (const hint of hints) {
    console.error(hint)
  }
  process.exit(1)
}

export function resolveMigrationTarget(target: MigrationTarget): { databaseUrl: string, label: string } {
  switch (target) {
    case 'local':
      loadApiEnvFile()
      break
    case 'staging':
    case 'production':
      loadRepoEnvFile()
      break
  }

  const databaseUrl = target === 'staging'
    ? process.env['STAGING_DATABASE_URL'] ?? process.env['DATABASE_URL']
    : target === 'production'
      ? process.env['PRODUCTION_DATABASE_URL'] ?? process.env['DATABASE_URL']
      : process.env['DATABASE_URL']

  if (!databaseUrl || databaseUrl === 'memory') {
    const hints = target === 'local'
      ? ['Set DATABASE_URL in apps/api/.env (e.g. pglite:.data/school).']
      : target === 'staging'
        ? [
            'Set STAGING_DATABASE_URL (or DATABASE_URL) to the Neon staging branch connection string.',
            'Example: STAGING_DATABASE_URL=postgres://… bun run db:migrate:staging',
          ]
        : [
            'Set PRODUCTION_DATABASE_URL (or DATABASE_URL) to the Neon production branch connection string.',
            'Example: PRODUCTION_DATABASE_URL=postgres://… in repo root `.env`',
          ]
    fail(`Missing database URL for ${target} migrations.`, hints)
  }

  if ((target === 'staging' || target === 'production') && isPgliteDatabase(databaseUrl)) {
    fail(
      `${target} migrations require a Postgres connection string, not PGlite.`,
      [`Set ${target === 'staging' ? 'STAGING_DATABASE_URL' : 'PRODUCTION_DATABASE_URL'} in repo root .env.`],
    )
  }

  if (databaseUrl === 'pglite') {
    fail(
      'Ephemeral PGlite (DATABASE_URL=pglite) cannot be migrated.',
      ['Use a persisted path such as pglite:.data/school in apps/api/.env.'],
    )
  }

  const resolvedDatabaseUrl = target === 'local'
    ? resolveLocalDatabaseUrl(databaseUrl)
    : databaseUrl

  return { databaseUrl: resolvedDatabaseUrl, label: target }
}
