import { resolve } from 'node:path'
import process from 'node:process'
import { runAccountMigrations } from '@edaya/adaptor-account'
import { runMigrations } from '@edaya/adaptor-auth'
import { PGlite } from '@electric-sql/pglite'
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { resolveIdentityMigrationTarget } from './lib/resolve-migration-target'

const { databaseUrl, label } = resolveIdentityMigrationTarget(process.argv.slice(2), process.env, resolve(import.meta.dirname, '../../../..'))
console.log(`Applying identity migrations (${label})`)

if (databaseUrl.startsWith('pglite:')) {
  const dataDir = resolve(databaseUrl.slice('pglite:'.length).trim() || '.data/identity')
  const pglite = new PGlite(dataDir)
  try {
    await runMigrations(drizzlePglite(pglite), { driver: 'pglite' })
    await runAccountMigrations(drizzlePglite(pglite), 'pglite')
  }
  finally {
    await pglite.close()
  }
}
else {
  const sql = postgres(databaseUrl, { max: 1 })
  try {
    await runMigrations(drizzlePostgres(sql), { driver: 'postgres-js' })
    await runAccountMigrations(drizzlePostgres(sql), 'postgres-js')
  }
  finally {
    await sql.end({ timeout: 5 })
  }
}
