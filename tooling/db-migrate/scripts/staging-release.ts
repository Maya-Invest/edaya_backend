/* eslint-disable dot-notation -- TypeScript requires bracket access for index signatures */
import process from 'node:process'
import postgres from 'postgres'
import { applySchoolMigrations } from './lib/apply-school-migrations'
import { resetRemoteDatabase } from './lib/reset-remote-database'

const value = process.env['STAGING_DATABASE_URL'] ?? ''
let url: URL
try {
  url = new URL(value)
}
catch {
  throw new Error('Missing or invalid staging school database URL')
}
if (process.env['RELEASE_TARGET'] !== 'staging'
  || !['true', 'false'].includes(process.env['RESET_DATA'] ?? '')
  || !process.env['STAGING_DATABASE_HOST']
  || url.hostname !== process.env['STAGING_DATABASE_HOST']
  || url.hostname.includes('-pooler') || url.pathname !== '/neondb'
  || !['postgres:', 'postgresql:'].includes(url.protocol)) {
  throw new Error('Explicit direct staging school database and reset switch required')
}
const sql = postgres(value, { max: 1 })
try {
  const [database] = await sql`SELECT current_database() AS name`
  if (database?.['name'] !== 'neondb') {
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
