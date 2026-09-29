import { runAccountMigrations } from '@edaya/adaptor-account'
import { runMigrations } from '@edaya/adaptor-auth'
import { PGlite } from '@electric-sql/pglite'
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { resolve } from 'node:path'
import process from 'node:process'

const databaseUrl = process.env['AUTH_DATABASE_URL']
  ?? process.env['STAGING_AUTH_DATABASE_URL']
  ?? process.env['PRODUCTION_AUTH_DATABASE_URL']

if (!databaseUrl) {
  throw new Error('Set AUTH_DATABASE_URL (or STAGING_AUTH_DATABASE_URL / PRODUCTION_AUTH_DATABASE_URL)')
}

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
