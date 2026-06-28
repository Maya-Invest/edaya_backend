import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate as migrateBunSqlite } from 'drizzle-orm/bun-sqlite/migrator'
import { migrate as migrateD1 } from 'drizzle-orm/d1/migrator'

export type MigrationDriver = 'd1' | 'sqlite'

function getPackageRoot(): string {
  if (typeof import.meta.url !== 'string' || import.meta.url.length === 0) {
    throw new Error('Cannot resolve Better Auth migrations folder in this runtime')
  }

  return join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
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
  const migrate = options.driver === 'd1' ? migrateD1 : migrateBunSqlite
  await migrate(db as never, { migrationsFolder })
}
