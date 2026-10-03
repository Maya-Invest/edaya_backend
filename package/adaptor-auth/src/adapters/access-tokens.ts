import type { SQL } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import { sql } from 'drizzle-orm'

export interface AccessSession {
  user: { id: string, email: string, name: string, emailVerified: boolean }
  session: { id: string, createdAt: Date, expiresAt: Date }
}

function rows<T>(result: unknown): T[] {
  if (Array.isArray(result))
    return result as T[]
  if (result && typeof result === 'object' && 'rows' in result && Array.isArray(result.rows))
    return result.rows as T[]
  throw new Error('Unsupported auth database query result')
}

function digest(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Rate-limit buckets and Better Auth session revocation. Access JWTs are signed in apps/api/src/identity. */
export function createAccessTokenStore(database: unknown) {
  const db = database as { execute: (query: SQL) => Promise<unknown> }
  return {
    async takeQuota(key: string, maximum: number, now = new Date()): Promise<boolean> {
      const minute = Math.floor(now.getTime() / 60_000)
      const [row] = rows<{ attempts: number }>(await db.execute(sql`
        INSERT INTO auth.edaya_auth_rate_buckets (id, attempts, expires_at)
        VALUES (${digest(`${key}:${minute}`)}, 1, ${new Date((minute + 2) * 60_000).toISOString()})
        ON CONFLICT (id) DO UPDATE SET attempts = LEAST(auth.edaya_auth_rate_buckets.attempts + 1, ${maximum + 1})
        RETURNING attempts
      `))
      return !!row && row.attempts <= maximum
    },
    async revokeSession(sessionId: string): Promise<void> {
      await db.execute(sql`DELETE FROM auth.session WHERE id = ${sessionId}`)
    },
    async revokeSubjectSessions(subjectId: string): Promise<void> {
      await db.execute(sql`DELETE FROM auth.session WHERE user_id = ${subjectId}`)
    },
    async purgeExpired(now = new Date(), limit = 500): Promise<void> {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000)
        throw new Error('Access token cleanup limit must be between 1 and 1000')
      await db.execute(sql`DELETE FROM auth.edaya_auth_rate_buckets WHERE id IN (
        SELECT id FROM auth.edaya_auth_rate_buckets WHERE expires_at <= ${now.toISOString()} ORDER BY expires_at LIMIT ${limit}
      )`)
      await db.execute(sql`DELETE FROM auth.edaya_access_tokens WHERE digest IN (
        SELECT digest FROM auth.edaya_access_tokens WHERE expires_at <= ${now.toISOString()} ORDER BY expires_at LIMIT ${limit}
      )`)
    },
  }
}
