import type { SQL } from 'drizzle-orm'
import { createHash, randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'

export const DELEGATION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000
export const EXTERNAL_ACCESS_PREFIX = 'edaya_oat_'
export const EXTERNAL_REFRESH_PREFIX = 'edaya_ort_'
export const hashOAuthToken = (token: string) => createHash('sha256').update(token).digest('hex')

export interface DelegationGrant {
  id: string
  subjectId: string
  clientId: string
  guardianId: string
  schoolId: string
  studentIds: string[]
  scopes: string[]
  createdAt: Date
  expiresAt: Date
}

function rows<T>(result: unknown): T[] {
  if (Array.isArray(result))
    return result as T[]
  if (result && typeof result === 'object' && 'rows' in result && Array.isArray(result.rows))
    return result.rows as T[]
  throw new Error('Unsupported auth database query result')
}

/** Mutations run inside createAuthTransactions, alongside provider code/tokens. */
export function createDelegationGrantStore(database: unknown) {
  const db = database as { execute: (query: SQL) => Promise<unknown> }
  const store = {
    async create(input: Omit<DelegationGrant, 'id' | 'createdAt' | 'expiresAt'>, now = new Date()): Promise<DelegationGrant> {
      if (!input.studentIds.length || !input.scopes.length)
        throw new Error('Consent requires explicit children and scopes')
      const grant = { ...input, id: randomUUID(), createdAt: now, expiresAt: new Date(now.getTime() + DELEGATION_LIFETIME_MS) }
      await db.execute(sql`INSERT INTO auth.edaya_delegation_grants (id, subject_id, client_id, guardian_id, school_id, created_at, expires_at)
        VALUES (${grant.id}, ${grant.subjectId}, ${grant.clientId}, ${grant.guardianId}, ${grant.schoolId}, ${now}, ${grant.expiresAt})`)
      for (const studentId of new Set(grant.studentIds))
        await db.execute(sql`INSERT INTO auth.edaya_delegation_children (grant_id, student_id) VALUES (${grant.id}, ${studentId})`)
      for (const scope of new Set(grant.scopes))
        await db.execute(sql`INSERT INTO auth.edaya_delegation_scopes (grant_id, scope) VALUES (${grant.id}, ${scope})`)
      return grant
    },
    async findActive(id: string, now = new Date()): Promise<DelegationGrant | null> {
      const [row] = rows<{
        id: string
        subject_id: string
        client_id: string
        guardian_id: string
        school_id: string
        created_at: Date | string
        expires_at: Date | string
        student_ids: string[]
        scopes: string[]
      }>(await db.execute(sql`
        SELECT g.*, ARRAY(SELECT student_id FROM auth.edaya_delegation_children WHERE grant_id = g.id ORDER BY student_id) AS student_ids,
          ARRAY(SELECT scope FROM auth.edaya_delegation_scopes WHERE grant_id = g.id AND scope = ANY(c.scopes) ORDER BY scope) AS scopes
        FROM auth.edaya_delegation_grants g JOIN auth.oauth_client c ON c.client_id = g.client_id
        JOIN auth."user" u ON u.id = g.subject_id
        WHERE g.id = ${id} AND g.revoked_at IS NULL AND g.expires_at > ${now} AND c.disabled IS NOT TRUE
      `))
      return row
        ? {
            id: row.id,
            subjectId: row.subject_id,
            clientId: row.client_id,
            guardianId: row.guardian_id,
            schoolId: row.school_id,
            studentIds: row.student_ids,
            scopes: row.scopes,
            createdAt: new Date(row.created_at),
            expiresAt: new Date(row.expires_at),
          }
        : null
    },
    async listForSubject(subjectId: string, after?: string) {
      const records = rows<{
        id: string
        client_id: string
        client_name: string
        purpose: string | null
        school_id: string
        student_ids: string[]
        scopes: string[]
        created_at: Date | string
        expires_at: Date | string
      }>(await db.execute(sql`
        SELECT g.id, g.client_id, c.name AS client_name, c.metadata->>'purpose' AS purpose,
          g.school_id, g.created_at, g.expires_at,
          ARRAY(SELECT student_id FROM auth.edaya_delegation_children WHERE grant_id = g.id ORDER BY student_id) AS student_ids,
          ARRAY(SELECT scope FROM auth.edaya_delegation_scopes WHERE grant_id = g.id AND scope = ANY(c.scopes) ORDER BY scope) AS scopes
        FROM auth.edaya_delegation_grants g JOIN auth.oauth_client c ON c.client_id = g.client_id
        WHERE g.subject_id = ${subjectId} AND g.revoked_at IS NULL AND g.expires_at > NOW()
          AND c.disabled IS NOT TRUE ${after ? sql`AND g.id > ${after}` : sql``}
        ORDER BY g.id LIMIT 51
      `))
      const items = records.slice(0, 50).map(row => ({
        id: row.id,
        clientId: row.client_id,
        clientName: row.client_name,
        purpose: row.purpose ?? '',
        schoolId: row.school_id,
        studentIds: row.student_ids,
        scopes: row.scopes,
        createdAt: new Date(row.created_at).toISOString(),
        expiresAt: new Date(row.expires_at).toISOString(),
      }))
      return { items, nextCursor: records.length > 50 ? items.at(-1)!.id : null }
    },
    async findTokenGrant(token: string, kind: 'access' | 'refresh'): Promise<DelegationGrant | null> {
      const prefix = kind === 'access' ? EXTERNAL_ACCESS_PREFIX : EXTERNAL_REFRESH_PREFIX
      if (!token.startsWith(prefix))
        return null
      const table = kind === 'access' ? sql`auth.oauth_access_token` : sql`auth.oauth_refresh_token`
      const [row] = rows<{ reference_id: string, client_id: string, user_id: string, scopes: string[] }>(await db.execute(sql`
        SELECT reference_id, client_id, user_id, scopes FROM ${table}
        WHERE token = ${hashOAuthToken(token.slice(prefix.length))} AND expires_at > NOW()
        ${kind === 'access' ? sql`AND revoked IS NULL` : sql``}
      `))
      // Refresh replay must reach the provider so it can revoke the whole family.
      const grant = row?.reference_id ? await store.findActive(row.reference_id) : null
      return grant && row && grant.clientId === row.client_id && grant.subjectId === row.user_id
        ? { ...grant, scopes: grant.scopes.filter(scope => row.scopes.includes(scope)) }
        : null
    },
    async revoke(id: string, subjectId: string): Promise<boolean> {
      const result = rows(await db.execute(sql`UPDATE auth.edaya_delegation_grants SET revoked_at = COALESCE(revoked_at, NOW())
        WHERE id = ${id} AND subject_id = ${subjectId} RETURNING id`))
      return result.length > 0
    },
    async revokeSubject(subjectId: string): Promise<void> {
      await db.execute(sql`UPDATE auth.edaya_delegation_grants SET revoked_at = COALESCE(revoked_at, NOW()) WHERE subject_id = ${subjectId}`)
    },
    async capTokenLifetimes(grantId: string): Promise<void> {
      // Runs in the same protocol transaction as minting; absolute family expiry
      // is fixed by consent and cannot slide forward on refresh.
      for (const table of [sql`auth.oauth_access_token`, sql`auth.oauth_refresh_token`]) {
        await db.execute(sql`UPDATE ${table} t SET expires_at = g.expires_at FROM auth.edaya_delegation_grants g
          WHERE g.id = ${grantId} AND t.reference_id = g.id AND t.expires_at > g.expires_at`)
      }
    },
  }
  return store
}
