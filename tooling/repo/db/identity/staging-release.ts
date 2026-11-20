import process from 'node:process'
import { runAccountMigrations } from '@edaya/adaptor-account'
import { runMigrations } from '@edaya/adaptor-auth'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { assertStagingMutationAllowed, stagingDatabaseTarget } from '../lib/staging-validation'

assertStagingMutationAllowed(process.env['STAGING_AUTH_DATABASE_URL'] ?? '', process.env)
const url = stagingDatabaseTarget('identity', process.env).toString()
const sql = postgres(url, { max: 1 })
try {
  await runMigrations(drizzle(sql), { driver: 'postgres-js' })
  await runAccountMigrations(drizzle(sql), 'postgres-js')
  if (process.env['RESET_DATA'] === 'true') {
    if (process.env['STAGING_MAINTENANCE_CONFIRMED'] !== 'true') {
      throw new Error('Identity reset requires confirmed maintenance')
    }
    await sql.begin(async (tx) => {
      // Explicit initial reset: retain EDaya signing keys, remove Accounts and sessions.
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
