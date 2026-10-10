import process from 'node:process'
import postgres from 'postgres'
import { assertStagingMutationAllowed, stagingDatabaseTarget } from '../lib/staging-validation'
import { applySchoolMigrations } from './lib/apply-school-migrations'
import { resetRemoteDatabase } from './lib/reset-remote-database'

assertStagingMutationAllowed(process.env['STAGING_DATABASE_URL'] ?? '', process.env)
const url = stagingDatabaseTarget('school', process.env)
const value = url.toString()
const sql = postgres(value, { max: 1 })
try {
  const [database] = await sql`SELECT current_database() AS name`
  if (database?.['name'] !== decodeURIComponent(url.pathname.slice(1))) {
    throw new Error('Unexpected school database')
  }
}
finally {
  await sql.end({ timeout: 5 })
}
if (process.env['RESET_DATA'] === 'true') {
  if (process.env['STAGING_MAINTENANCE_CONFIRMED'] !== 'true') {
    throw new Error('School reset requires confirmed maintenance')
  }
  await resetRemoteDatabase(value)
}
await applySchoolMigrations(value)
console.log('Staging school migration/reset complete')
