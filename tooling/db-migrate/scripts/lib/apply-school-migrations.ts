import { spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import {
  resolveMigrationDriver,
  resolvePgliteDataDir,
  runMigrations,
} from '@edaya/adaptor-postgres'
import { PGlite } from '@electric-sql/pglite'
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import { repairDrizzleMigrationJournal } from '../repair-drizzle-journal'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export async function applySchoolMigrations(databaseUrl: string): Promise<void> {
  const driver = resolveMigrationDriver(databaseUrl)

  console.log('\n> Applying school schema migrations')

  if (driver === 'pglite') {
    const dataDir = resolvePgliteDataDir(databaseUrl)
    const pglite = dataDir ? new PGlite(dataDir) : new PGlite()
    const db = drizzlePglite(pglite)
    await runMigrations(db, { driver: 'pglite' })
    await pglite.close()
    return
  }

  await repairDrizzleMigrationJournal(databaseUrl)

  const result = spawnSync('bun', ['run', 'migrate'], {
    cwd: packageRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
