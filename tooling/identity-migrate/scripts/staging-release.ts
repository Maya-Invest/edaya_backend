import { runAccountMigrations } from '@edaya/adaptor-account'
import { assertStagingFixtureTarget, runMigrations } from '@edaya/adaptor-auth'
import { drizzle } from 'drizzle-orm/postgres-js'
import process from 'node:process'
import postgres from 'postgres'

const url = process.env['STAGING_AUTH_DATABASE_URL'] ?? ''
assertStagingFixtureTarget(url, process.env['STAGING_DATABASE_HOST'] ?? '')
if (process.env['RELEASE_TARGET'] !== 'staging' || !['true', 'false'].includes(process.env['RESET_DATA'] ?? '')) {
  throw new Error('Explicit staging release target and reset switch required')
}
const sql = postgres(url, { max: 1 })
try {
  await runMigrations(drizzle(sql), { driver: 'postgres-js' })
  await runAccountMigrations(drizzle(sql), 'postgres-js')
  if (process.env['RESET_DATA'] === 'true') {
    if (process.env['STAGING_MAINTENANCE_CONFIRMED'] !== 'true') {
      throw new Error('Identity reset requires confirmed maintenance')
    }
    await sql.begin(async (tx) => {
      // Explicit initial reset: retain Edaya signing keys, remove Accounts and sessions.
      await tx`TRUNCATE identity.account CASCADE`
      await tx`TRUNCATE identity.challenge, identity.quota`
      await tx`DELETE FROM auth."user"`
      await tx`DELETE FROM auth.verification`
      await tx`DELETE FROM auth.edaya_auth_rate_buckets`
    })
  }
  console.log('Staging identity migration/reset complete')
}
finally {
  await sql.end({ timeout: 5 })
}
