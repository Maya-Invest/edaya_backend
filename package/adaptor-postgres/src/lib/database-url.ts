import type { MigrationDriver } from './migrate'
import path from 'node:path'

const EPHEMERAL_DATABASE_URLS = new Set(['memory', 'pglite', 'memory://'])

export function isEphemeralDatabase(databaseUrl: string): boolean {
  return EPHEMERAL_DATABASE_URLS.has(databaseUrl)
    || databaseUrl.startsWith('postgres://memory')
}

export function isPgliteDatabase(databaseUrl: string): boolean {
  return isEphemeralDatabase(databaseUrl)
    || databaseUrl.startsWith('pglite:')
    || databaseUrl.startsWith('file://')
}

export function resolvePgliteDataDir(databaseUrl: string): string | undefined {
  if (!isPgliteDatabase(databaseUrl) || isEphemeralDatabase(databaseUrl)) {
    return undefined
  }

  if (databaseUrl.startsWith('pglite:')) {
    const dataDir = databaseUrl.slice('pglite:'.length).trim()
    if (!dataDir) {
      throw new Error('DATABASE_URL pglite: prefix requires a data directory path')
    }
    return dataDir
  }

  if (databaseUrl.startsWith('file://')) {
    const dataDir = databaseUrl.slice('file://'.length).trim()
    if (!dataDir) {
      throw new Error('DATABASE_URL file:// prefix requires a data directory path')
    }
    return dataDir
  }

  return undefined
}

/**
 * Resolves persisted PGlite paths for local dev. Relative `.data/…` is anchored to `repoRoot`
 * so migrations (`bun repo ops db migrate school local`) and the API use the same files regardless of cwd.
 */
export function resolvePersistedPgliteDataDir(
  databaseUrl: string,
  options: { repoRoot?: string } = {},
): string | undefined {
  const dataDir = resolvePgliteDataDir(databaseUrl)
  if (!dataDir) {
    return undefined
  }

  if (path.isAbsolute(dataDir)) {
    return dataDir
  }

  const normalized = dataDir.replace(/^\.\//, '')
  if (options.repoRoot && (normalized === '.data' || normalized.startsWith('.data/'))) {
    return path.resolve(options.repoRoot, normalized)
  }

  return dataDir
}

export function resolveMigrationDriver(databaseUrl: string): MigrationDriver {
  // App/Worker Postgres uses node-postgres (`pg`). CLI tooling may still pass `postgres-js` explicitly.
  return isPgliteDatabase(databaseUrl) ? 'pglite' : 'node-postgres'
}
