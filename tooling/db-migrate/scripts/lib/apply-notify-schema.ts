import { mkdirSync } from 'node:fs'
import { applyNotifySchemaOnDrizzle } from '@edaya/adaptor-notify'
import { resolveMigrationDriver, resolvePgliteDataDir } from '@edaya/adaptor-postgres'
import { PGlite } from '@electric-sql/pglite'
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { isPgliteLockError, pgliteLockHelpMessage } from './pglite-lock-error'

export async function applyNotifySchema(databaseUrl: string): Promise<void> {
  const driver = resolveMigrationDriver(databaseUrl)

  console.log('\n> Applying notify schema')

  if (driver === 'pglite') {
    const dataDir = resolvePgliteDataDir(databaseUrl)
    let pglite: PGlite | undefined
    try {
      if (dataDir) {
        mkdirSync(dataDir, { recursive: true })
      }
      pglite = dataDir ? new PGlite(dataDir) : new PGlite()
      const db = drizzlePglite(pglite)
      await applyNotifySchemaOnDrizzle(db)
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

  const sql = postgres(databaseUrl, { max: 1 })
  const db = drizzlePostgres(sql)
  await applyNotifySchemaOnDrizzle(db)
  await sql.end({ timeout: 5 })
}
