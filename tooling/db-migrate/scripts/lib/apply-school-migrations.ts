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
      const detail = error instanceof Error ? error.message : String(error)
      if (/mutex|Aborted\(\)/i.test(detail)) {
        throw new Error(
          'Could not open local PGlite database — it is locked by a running API process. '
          + 'Stop `bun dev` completely, then rerun `bun repo db migrate local`. '
          + 'Alternatively: `bun repo seed clean --yes`, then `bun dev` (migrations apply on startup).',
          { cause: error },
        )
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
