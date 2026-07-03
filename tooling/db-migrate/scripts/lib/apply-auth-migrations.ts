import { runMigrations } from '@edaya/adaptor-auth'
import {
  resolveMigrationDriver,
  resolvePgliteDataDir,
} from '@edaya/adaptor-postgres'
import { PGlite } from '@electric-sql/pglite'
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

export async function applyAuthMigrations(databaseUrl: string): Promise<void> {
  const driver = resolveMigrationDriver(databaseUrl)

  if (driver === 'pglite') {
    const dataDir = resolvePgliteDataDir(databaseUrl)
    const pglite = dataDir ? new PGlite(dataDir) : new PGlite()
    const db = drizzlePglite(pglite)
    await runMigrations(db, { driver: 'pglite' })
    await pglite.close()
    return
  }

  const sql = postgres(databaseUrl, { max: 1 })
  const db = drizzlePostgres(sql)
  await runMigrations(db, { driver: 'postgres-js' })
  await sql.end({ timeout: 5 })
}
