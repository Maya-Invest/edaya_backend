import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate as migrateNodePostgres } from 'drizzle-orm/node-postgres/migrator'
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator'
import { migrate as migratePostgresJs } from 'drizzle-orm/postgres-js/migrator'

export type MigrationDriver = 'pglite' | 'postgres-js' | 'node-postgres'

function getPackageRoot(): string {
  if (typeof import.meta.url !== 'string' || import.meta.url.length === 0) {
    throw new Error('Cannot resolve Better Auth migrations folder in this runtime')
  }

  return join(dirname(fileURLToPath(import.meta.url)), '..', '..')
}

/** Resolve the SQL migrations folder from the installed package root. */
export function getMigrationsFolder(): string {
  return join(getPackageRoot(), 'drizzle', 'auth')
}

export async function runMigrations(
  db: unknown,
  options: { driver: MigrationDriver },
): Promise<void> {
  const migrationsFolder = getMigrationsFolder()
  const migrate = options.driver === 'pglite'
    ? migratePglite
    : options.driver === 'node-postgres'
      ? migrateNodePostgres
      : migratePostgresJs
  await migrate(db as never, { migrationsFolder })
}
