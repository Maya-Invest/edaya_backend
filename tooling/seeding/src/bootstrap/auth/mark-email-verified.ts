/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */
import process from 'node:process'
import { isStagingSeedApiUrl } from './staging-user-repair'

function escapeSqlString(value: string): string {
  return value.replaceAll('\'', '\'\'')
}

function resolveAuthDatabaseUrl(apiOrigin?: string): string | undefined {
  if (apiOrigin && isStagingSeedApiUrl(apiOrigin)) {
    return process.env['STAGING_DATABASE_URL'] ?? process.env['DATABASE_URL']
  }
  return process.env['DATABASE_URL'] ?? process.env['STAGING_DATABASE_URL']
}

/**
 * Mark a Better Auth user as email-verified via direct SQL.
 * Used by HTTP seed provisioners (staging / remote) where internalAdapter is unavailable.
 */
export async function markAuthUserEmailVerifiedBySql(args: {
  subjectId?: string
  email?: string
  apiOrigin?: string
}): Promise<void> {
  const databaseUrl = resolveAuthDatabaseUrl(args.apiOrigin)
  if (!databaseUrl?.trim() || databaseUrl.startsWith('pglite') || databaseUrl === 'memory') {
    return
  }

  if (!args.subjectId && !args.email) {
    throw new Error('markAuthUserEmailVerifiedBySql requires subjectId or email')
  }

  const postgres = (await import('postgres')).default
  const sql = postgres(databaseUrl, { max: 1 })

  try {
    if (args.subjectId) {
      await sql.unsafe(
        `UPDATE auth."user" SET email_verified = true WHERE id = '${escapeSqlString(args.subjectId)}'`,
      )
      return
    }

    await sql.unsafe(
      `UPDATE auth."user" SET email_verified = true WHERE email = '${escapeSqlString(args.email!)}'`,
    )
  }
  finally {
    await sql.end({ timeout: 5 })
  }
}
