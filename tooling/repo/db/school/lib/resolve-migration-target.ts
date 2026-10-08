import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { isPgliteDatabase, resolvePersistedPgliteDataDir } from '@edaya/adaptor-postgres'
import { config } from 'dotenv'
import { expand } from 'dotenv-expand'
import { loadLocalConfiguration } from '../../../../../apps/api/configuration/index.mjs'

export type MigrationTarget = 'local' | 'staging' | 'production'
export type MigrationScope = 'school'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..')

function loadApiEnvFile(): void {
  loadLocalConfiguration(process.env)
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

  const resolvedDir = resolvePersistedPgliteDataDir(databaseUrl, { repoRoot })
  if (!resolvedDir) {
    return databaseUrl
  }

  const prefix = databaseUrl.startsWith('file://') ? 'file://' : 'pglite:'
  return `${prefix}${resolvedDir}`
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
    ? process.env['STAGING_DATABASE_URL']
    : target === 'production'
      ? process.env['PRODUCTION_DATABASE_URL']
      : process.env['DATABASE_URL']

  if (!databaseUrl || databaseUrl === 'memory') {
    const hints = target === 'local'
      ? ['Set DATABASE_URL in apps/api/config.local.jsonc (e.g. pglite:.data/school).']
      : target === 'staging'
        ? [
            'Set STAGING_DATABASE_URL to the Neon staging branch connection string.',
            'Example: STAGING_DATABASE_URL=postgres://… bun repo db migrate school staging',
          ]
        : [
            'Set PRODUCTION_DATABASE_URL to the Neon production branch connection string.',
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
      ['Use a persisted path such as pglite:.data/school in apps/api/config.local.jsonc.'],
    )
  }

  const resolvedDatabaseUrl = target === 'local'
    ? resolveLocalDatabaseUrl(databaseUrl)
    : databaseUrl

  return { databaseUrl: resolvedDatabaseUrl, label: target }
}
