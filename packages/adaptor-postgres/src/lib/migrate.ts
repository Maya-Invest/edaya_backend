import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator'
import { migrate as migratePostgresJs } from 'drizzle-orm/postgres-js/migrator'

export type MigrationDriver = 'pglite' | 'postgres-js'

/** Resolve the SQL migrations folder from package root (works from `dist/` or `src/`). */
export function getMigrationsFolder(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url))
  const candidates = [
    join(currentDir, '../drizzle'),
    join(currentDir, '../../drizzle'),
  ]
  for (const folder of candidates) {
    if (existsSync(folder)) {
      return folder
    }
  }
  return candidates[0]!
}

export async function runMigrations(
  db: unknown,
  options: { driver: MigrationDriver },
): Promise<void> {
  const migrationsFolder = getMigrationsFolder()
  const migrate = options.driver === 'pglite' ? migratePglite : migratePostgresJs
  await migrate(db as never, { migrationsFolder })
}
