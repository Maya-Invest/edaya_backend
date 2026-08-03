import { runMigrations } from '@edaya/adaptor-auth'
import {
  resolveMigrationDriver,
  resolvePgliteDataDir,
} from '@edaya/adaptor-postgres'
import { PGlite } from '@electric-sql/pglite'
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { isPgliteLockError, pgliteLockHelpMessage } from './pglite-lock-error'
import { syncAuthMigrationJournalTimestamps } from './sync-auth-migration-journal'

export async function applyAuthMigrations(databaseUrl: string): Promise<void> {
  const driver = resolveMigrationDriver(databaseUrl)

  if (driver === 'pglite') {
    const dataDir = resolvePgliteDataDir(databaseUrl)
    let pglite: PGlite | undefined
    try {
      pglite = dataDir ? new PGlite(dataDir) : new PGlite()
      const db = drizzlePglite(pglite)
      await runMigrations(db, { driver: 'pglite' })
    }
    catch (error) {
      if (isPgliteLockError(error)) {
        throw new Error(pgliteLockHelpMessage(), { cause: error })
      }
      throw error
    }
    finally {
      await pglite?.close()
    }
    return
  }

  await syncAuthMigrationJournalTimestamps(databaseUrl)

  const sql = postgres(databaseUrl, { max: 1 })
  const db = drizzlePostgres(sql)
  await runMigrations(db, { driver: 'postgres-js' })
  await sql.end({ timeout: 5 })
}
