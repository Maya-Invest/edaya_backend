/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */
import process from 'node:process'
import { isStagingSeedApiUrl } from '../../support/resolve-seed-env'

function escapeSqlString(value: string): string {
  return value.replaceAll('\'', '\'\'')
}

export { isStagingSeedApiUrl } from '../../support/resolve-seed-env'

export function shouldRepairStaleStagingAuthUsers(baseUrl: string): boolean {
  if (!isStagingSeedApiUrl(baseUrl)) {
    return false
  }

  const flag = process.env['SEED_AUTH_REPAIR_STALE']?.trim().toLowerCase()
  return flag !== 'false' && flag !== '0' && flag !== 'no'
}

/** Remove a broken Better Auth user from staging Neon so sign-up can recreate it. */
export async function repairStagingAuthUser(email: string): Promise<void> {
  const databaseUrl = process.env['STAGING_DATABASE_URL'] ?? process.env['DATABASE_URL']
  if (!databaseUrl?.trim()) {
    throw new Error('Set STAGING_DATABASE_URL before repairing staging auth users.')
  }

  const postgres = (await import('postgres')).default
  const sql = postgres(databaseUrl, { max: 1 })
  const command = `DELETE FROM auth."user" WHERE email = '${escapeSqlString(email)}';`

  try {
    await sql.unsafe(command)
  }
  finally {
    await sql.end({ timeout: 5 })
  }
}
