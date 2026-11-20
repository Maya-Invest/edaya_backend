import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator'
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator'

export async function runAccountMigrations(db: unknown, driver: 'pglite' | 'postgres-js') {
  const migrate = driver === 'pglite' ? migratePglite : migratePostgres
  await migrate(db as never, { migrationsFolder: resolve(dirname(fileURLToPath(import.meta.url)), '../drizzle'), migrationsSchema: 'drizzle', migrationsTable: '__account_migrations' })
}
