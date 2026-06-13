import type { MigrationDriver } from './migrate'

export function isEphemeralDatabase(databaseUrl: string): boolean {
  return databaseUrl === 'memory'
    || databaseUrl === 'pglite'
    || databaseUrl.startsWith('postgres://memory')
}

export function resolveMigrationDriver(databaseUrl: string): MigrationDriver {
  return isEphemeralDatabase(databaseUrl) ? 'pglite' : 'postgres-js'
}
