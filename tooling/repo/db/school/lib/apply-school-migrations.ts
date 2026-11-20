import { mkdirSync } from 'node:fs'
import {
  resolveMigrationDriver,
  resolvePgliteDataDir,
  runMigrations,
} from '@edaya/adaptor-postgres'
import { PGlite } from '@electric-sql/pglite'
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { repairDrizzleMigrationJournal } from '../repair-drizzle-journal'
import { isPgliteLockError, pgliteLockHelpMessage } from './pglite-lock-error'

export async function applySchoolMigrations(databaseUrl: string): Promise<void> {
  const driver = resolveMigrationDriver(databaseUrl)

  console.log('\n> Applying school schema migrations')

  if (driver === 'pglite') {
    const dataDir = resolvePgliteDataDir(databaseUrl)
    let pglite: PGlite | undefined
    try {
      if (dataDir) {
        mkdirSync(dataDir, { recursive: true })
      }
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

  await repairDrizzleMigrationJournal(databaseUrl)

  const sql = postgres(databaseUrl, { max: 1 })
  const db = drizzlePostgres(sql)
  await runMigrations(db, { driver: 'postgres-js' })
  await sql.end({ timeout: 5 })
}
