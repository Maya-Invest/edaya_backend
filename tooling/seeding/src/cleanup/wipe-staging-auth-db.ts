/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */
import process from 'node:process'

const WIPE_AUTH_SQL = [
  'DELETE FROM auth.session;',
  'DELETE FROM auth.account;',
  'DELETE FROM auth.verification;',
  'DELETE FROM auth."user";',
].join(' ')

export async function wipeStagingAuthDatabase(): Promise<void> {
  const databaseUrl = process.env['STAGING_DATABASE_URL'] ?? process.env['DATABASE_URL']

  if (!databaseUrl || databaseUrl === 'pglite' || databaseUrl === 'memory') {
    throw new Error('Set STAGING_DATABASE_URL (or DATABASE_URL) to the Neon staging branch connection string.')
  }

  const postgres = (await import('postgres')).default
  const sql = postgres(databaseUrl, { max: 1 })

  try {
    await sql.unsafe(WIPE_AUTH_SQL)
  }
  finally {
    await sql.end({ timeout: 5 })
  }
}
