import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator'
import { migrate as migratePostgresJs } from 'drizzle-orm/postgres-js/migrator'

export type MigrationDriver = 'pglite' | 'postgres-js'

const MIGRATIONS_TABLE = '__drizzle_migrations_betterauth'

const packageRoot = dirname(
  createRequire(import.meta.url).resolve('@edaya/adaptor-betterauth/package.json'),
)

/** Resolve the SQL migrations folder from the installed package root. */
export function getMigrationsFolder(): string {
  return join(packageRoot, 'drizzle')
}

export async function runMigrations(
  db: unknown,
  options: { driver: MigrationDriver },
): Promise<void> {
  const migrationsFolder = getMigrationsFolder()
  const migrate = options.driver === 'pglite' ? migratePglite : migratePostgresJs
  await migrate(db as never, {
    migrationsFolder,
    migrationsTable: MIGRATIONS_TABLE,
  })
}
