import type { SQL } from 'drizzle-orm'
import { createHash, randomBytes } from 'node:crypto'
import { sql } from 'drizzle-orm'

export const FIRST_PARTY_ACCESS_PREFIX = 'edaya_at_'
export const FIRST_PARTY_ACCESS_TTL_MS = 5 * 60 * 1000
const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000

export interface AccessSession {
  user: { id: string, email: string, name: string, emailVerified: boolean }
  session: { id: string, createdAt: Date, expiresAt: Date }
}

interface SessionRow {
  id: string
  user_id: string
  name: string
  email: string
  email_verified: boolean
  created_at: Date | string
  expires_at: Date | string
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

/** Database-only access authority; plaintext access tokens are returned once. */
export function createAccessTokenStore(database: unknown) {
  const db = database as { execute: (query: SQL) => Promise<unknown> }
  return {
    async takeQuota(key: string, maximum: number, now = new Date()): Promise<boolean> {
      const minute = Math.floor(now.getTime() / 60_000)
      const [row] = rows<{ attempts: number }>(await db.execute(sql`
        INSERT INTO auth.edaya_auth_rate_buckets (id, attempts, expires_at)
        VALUES (${digest(`${key}:${minute}`)}, 1, ${new Date((minute + 2) * 60_000)})
        ON CONFLICT (id) DO UPDATE SET attempts = LEAST(auth.edaya_auth_rate_buckets.attempts + 1, ${maximum + 1})
        RETURNING attempts
      `))
      return !!row && row.attempts <= maximum
    },
    async issue(sessionId: string, now = new Date()) {
      const accessToken = `${FIRST_PARTY_ACCESS_PREFIX}${randomBytes(32).toString('base64url')}`
      const expiresAt = new Date(now.getTime() + FIRST_PARTY_ACCESS_TTL_MS)
      const result = rows<{ expires_at: Date | string }>(await db.execute(sql`
        INSERT INTO auth.edaya_access_tokens (digest, session_id, created_at, expires_at)
        SELECT ${digest(accessToken)}, id, ${now}, LEAST(expires_at, created_at + interval '7 days', ${expiresAt})
        FROM auth.session WHERE id = ${sessionId} AND expires_at > ${now}
          AND created_at > ${new Date(now.getTime() - SESSION_LIFETIME_MS)}
        RETURNING expires_at
      `))
      if (!result[0])
        return null
      return { accessToken, tokenType: 'Bearer' as const, expiresAt: new Date(result[0].expires_at).toISOString() }
    },
    async resolve(token: string, now = new Date()): Promise<AccessSession | null> {
      if (!/^edaya_at_[\w-]{43}$/.test(token))
        return null
      const [row] = rows<SessionRow>(await db.execute(sql`
        SELECT s.id, s.user_id, s.created_at, s.expires_at, u.name, u.email, u.email_verified
        FROM auth.edaya_access_tokens t
        JOIN auth.session s ON s.id = t.session_id
        JOIN auth."user" u ON u.id = s.user_id
        WHERE t.digest = ${digest(token)} AND t.expires_at > ${now} AND s.expires_at > ${now}
          AND s.created_at > ${new Date(now.getTime() - SESSION_LIFETIME_MS)}
      `))
      return row
        ? {
            user: { id: row.user_id, name: row.name, email: row.email, emailVerified: row.email_verified },
            session: { id: row.id, createdAt: new Date(row.created_at), expiresAt: new Date(row.expires_at) },
          }
        : null
    },
    async revokeSession(sessionId: string): Promise<void> {
      await db.execute(sql`DELETE FROM auth.session WHERE id = ${sessionId}`)
    },
    async revokeSubjectSessions(subjectId: string): Promise<void> {
      await db.execute(sql`WITH revoked_grants AS (
        UPDATE auth.edaya_delegation_grants SET revoked_at = COALESCE(revoked_at, NOW())
        WHERE subject_id = ${subjectId} RETURNING id
      ) DELETE FROM auth.session WHERE user_id = ${subjectId}`)
    },
    async purgeExpired(now = new Date(), limit = 500): Promise<void> {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000)
        throw new Error('Access token cleanup limit must be between 1 and 1000')
      await db.execute(sql`DELETE FROM auth.edaya_auth_rate_buckets WHERE id IN (
        SELECT id FROM auth.edaya_auth_rate_buckets WHERE expires_at <= ${now} ORDER BY expires_at LIMIT ${limit}
      )`)
      await db.execute(sql`DELETE FROM auth.edaya_access_tokens WHERE digest IN (
        SELECT digest FROM auth.edaya_access_tokens WHERE expires_at <= ${now} ORDER BY expires_at LIMIT ${limit}
      )`)
    },
  }
}
