import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator'
import { migrate as migratePostgresJs } from 'drizzle-orm/postgres-js/migrator'

export type MigrationDriver = 'pglite' | 'postgres-js'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

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
  await migrate(db as never, { migrationsFolder })
}
