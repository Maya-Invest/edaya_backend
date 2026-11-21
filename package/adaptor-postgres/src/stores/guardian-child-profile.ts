import type { GuardianChildProfilePort, GuardianPhotoDecision, ResourceAccessScope } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import { guardianPaper, guardianPapersPageSize } from '@edaya/core'
import { sql } from 'drizzle-orm'
import { compileResourceAccess } from '../lib/resource-access-scope'
import { transactionContext } from '../lib/transaction'
import { documentIssuances, studentPhotoSubmissions } from '../postgres-schema'

interface Executor { execute: (query: SQL) => Promise<{ rows: Record<string, unknown>[] }> }

export class PostgresGuardianChildProfile implements GuardianChildProfilePort {
  constructor(private readonly db: Executor) {}

  async photoDecision(scope: ResourceAccessScope, studentId: string, guardianId: string): Promise<GuardianPhotoDecision> {
    const db = (transactionContext.getStore() as Executor | undefined) ?? this.db
    const visible = sql`student_id=${studentId} and ${compileResourceAccess(studentPhotoSubmissions, scope)}`
    const pending = await db.execute(sql`select id, submitter_guardian_id, attachment_id, version from ${studentPhotoSubmissions}
      where ${visible} and status='pending' limit 1`)
    const row = pending.rows[0] as { id: string, submitter_guardian_id: string, attachment_id: string, version: number } | undefined
    if (row) {
      return { status: 'pending', ownSubmission: row.submitter_guardian_id === guardianId ? { id: row.id, attachmentId: row.attachment_id, version: row.version } : null }
    }
    const reviewed = await db.execute(sql`select status, submitter_guardian_id, rejection_reason from ${studentPhotoSubmissions}
      where ${visible} and status in ('approved','rejected') order by coalesce(reviewed_at,updated_at) desc,id desc limit 1`)
    const latest = reviewed.rows[0] as { status: string, submitter_guardian_id: string, rejection_reason: string | null } | undefined
    return latest?.status === 'rejected' && latest.submitter_guardian_id === guardianId
      ? { status: 'rejected', reason: latest.rejection_reason }
      : { status: 'none' }
  }

  async papers(...[scope, input, templates, after]: Parameters<GuardianChildProfilePort['papers']>) {
    const db = (transactionContext.getStore() as Executor | undefined) ?? this.db
    const result = await db.execute(sql`select id, template_key as "templateKey", source_id as "sourceId", number, status from ${documentIssuances}
      where ${compileResourceAccess(documentIssuances, scope)} and student_id=${input.studentId} and academic_year_id=${input.academicYearId}
      and status='ready' and template_key=any(${sql.param(templates)}::text[]) ${after ? sql`and id > ${after}` : sql``}
      order by id limit ${guardianPapersPageSize + 1}`)
    return result.rows.map(row => guardianPaper.parse(row))
  }
}
