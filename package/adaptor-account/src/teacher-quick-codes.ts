import type { AccountDatabase } from './repository'
import { createHmac, randomInt } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { rows } from './repository'

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export interface QuickCodeTarget { teacherId: string, schoolId: string, accountId: string }
export function teacherQuickCodes(db: AccountDatabase, secret: string) {
  const digest = (code: string) => createHmac('sha256', secret).update('teacher-quick-code\0').update(code.trim().toUpperCase()).digest('hex')
  return {
    async active(target: QuickCodeTarget) {
      return rows<{ id: string, channel: string, hint: string, expiry: string | null }>(await db.execute(sql`SELECT request_id AS id,channel,destination_hint AS hint,expires_at AS expiry FROM identity.teacher_quick_code WHERE identifier_id IN (SELECT id FROM identity.identifier WHERE revoked_at IS NULL) AND teacher_id=${target.teacherId} AND school_id=${target.schoolId} AND account_id=${target.accountId} AND status='active' AND (expires_at IS NULL OR expires_at>${Date.now()})`))[0]
    },
    async lookup(code: string) {
      return rows<QuickCodeTarget>(await db.execute(sql`SELECT teacher_id AS "teacherId",school_id AS "schoolId",q.account_id AS "accountId" FROM identity.teacher_quick_code q JOIN identity.identifier i ON i.id=q.identifier_id AND i.revoked_at IS NULL WHERE digest=${digest(code)} AND status='active' AND (expires_at IS NULL OR expires_at>${Date.now()})`))[0]
    },
    async issue(target: QuickCodeTarget, input: { requestId: string, identifierId: string, channel: string, hint: string, expiry: number | null }, send: (code: string) => Promise<'accepted' | 'failed' | 'uncertain'>, activated?: (code: string) => void) {
      const { requestId, identifierId, channel, hint, expiry } = input
      // Commit the reservation before sending. A replay can never send twice.
      let code: string
      for (;;) {
        code = Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join('')
        const inserted = rows(await db.execute(sql`INSERT INTO identity.teacher_quick_code(request_id,teacher_id,school_id,account_id,identifier_id,channel,destination_hint,expires_at,digest,status) VALUES(${requestId},${target.teacherId},${target.schoolId},${target.accountId},${identifierId},${channel},${hint},${expiry},${digest(code)},'pending') ON CONFLICT DO NOTHING RETURNING sequence`))
        if (inserted.length)
          break
        const previous = rows<{ status: string }>(await db.execute(sql`SELECT status FROM identity.teacher_quick_code WHERE request_id=${requestId} AND school_id=${target.schoolId} AND teacher_id=${target.teacherId} AND account_id=${target.accountId}`))[0]
        if (previous)
          return previous.status
        if (rows(await db.execute(sql`SELECT 1 FROM identity.teacher_quick_code WHERE request_id=${requestId}`)).length)
          return 'failed'
      }
      const result = await send(code).catch(() => 'uncertain' as const)
      const status = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${target.schoolId}/${target.teacherId}`},0))`)
        let status: string = result
        if (result === 'accepted') {
          const [latest] = rows<{ id: string }>(await tx.execute(sql`SELECT request_id AS id FROM identity.teacher_quick_code WHERE school_id=${target.schoolId} AND teacher_id=${target.teacherId} ORDER BY sequence DESC LIMIT 1`))
          status = latest?.id === requestId ? 'active' : 'replaced'
          if (status === 'active')
            await tx.execute(sql`UPDATE identity.teacher_quick_code SET status='replaced' WHERE teacher_id=${target.teacherId} AND school_id=${target.schoolId} AND status='active'`)
        }
        await tx.execute(sql`UPDATE identity.teacher_quick_code SET status=${status} WHERE request_id=${requestId}`)
        return status
      })
      if (status === 'active')
        activated?.(code)
      return status
    },
  }
}
