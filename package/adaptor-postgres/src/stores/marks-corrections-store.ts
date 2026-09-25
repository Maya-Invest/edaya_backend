import type { MarksCorrection, MarksCorrectionsPort, ResourceAccessScope } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import { marksCorrectionSchema } from '@edaya/core'
import { sql } from 'drizzle-orm'
import { compileResourceAccess } from '../lib/resource-access-scope'
import { transactionContext } from '../lib/transaction'
import { assessments } from '../postgres-schema'

interface Executor { execute: (query: SQL) => Promise<{ rows: Array<{ id?: unknown, payload?: unknown, total?: unknown }> }> }
export class PostgresMarksCorrections implements MarksCorrectionsPort {
  constructor(private readonly db: Executor) {}
  private executor() { return (transactionContext.getStore() as Executor | undefined) ?? this.db }
  async find(schoolId: string, id: string) {
    const { rows } = await this.executor().execute(sql`select payload from assessment_marks_corrections where school_id=${schoolId} and id=${id}`)
    return rows[0] ? marksCorrectionSchema.parse(rows[0].payload) : undefined
  }

  async save(row: MarksCorrection) {
    const payload = JSON.stringify(row)
    await this.executor().execute(sql`insert into assessment_marks_corrections (id, school_id, assessment_id, status, version, payload)
      values (${row.id}, ${row.schoolId}, ${row.assessmentId}, ${row.status}, ${row.version}, ${payload}::jsonb)
      on conflict (id) do update set status=excluded.status, version=excluded.version, payload=excluded.payload`)
    await this.executor().execute(sql`update report_card_results r set pending_correction_ids=(
      select coalesce(jsonb_agg(c.id order by c.id), '[]'::jsonb) from assessment_marks_corrections c
      where c.school_id=${row.schoolId} and c.status='pending' and exists (
        select 1 from jsonb_array_elements(c.payload->'changes') change
        join jsonb_array_elements(r.source_marks) source on source->>'resultId'=change->>'resultId'
      )) where r.status='draft' and exists (
        select 1 from jsonb_array_elements(r.source_marks) source where source->>'assessmentId'=${row.assessmentId}
      ) and exists (select 1 from students s where s.id=r.student_id and s.school_id=${row.schoolId})`)
  }

  async forAssessment(schoolId: string, assessmentId: string) {
    const { rows } = await this.executor().execute(sql`select payload from assessment_marks_corrections where school_id=${schoolId} and assessment_id=${assessmentId} order by id`)
    return rows.map(row => marksCorrectionSchema.parse(row.payload))
  }

  async pendingForMarks(schoolId: string, ids: readonly string[]) {
    if (!ids.length)
      return []
    const { rows } = await this.executor().execute(sql`select c.id from assessment_marks_corrections c
      where c.school_id=${schoolId} and c.status='pending' and exists (
        select 1 from jsonb_array_elements(c.payload->'changes') change
        where change->>'resultId' in (${sql.join(ids.map(id => sql`${id}`), sql`, `)}))`)
    return rows.map(row => String(row.id))
  }

  async list(scope: ResourceAccessScope, input: Parameters<MarksCorrectionsPort['list']>[1]) {
    const predicate = sql`${compileResourceAccess(assessments, scope)}
      and c.status=${input.status ?? 'pending'}
      ${input.classGroupId ? sql`and ${assessments.classGroupId}=${input.classGroupId}` : sql``}
      ${input.periodId ? sql`and ${assessments.periodId}=${input.periodId}` : sql``}`
    const executor = this.executor()
    const [page, count] = await Promise.all([
      executor.execute(sql`select c.payload from assessment_marks_corrections c join ${assessments} on ${assessments.id}=c.assessment_id where ${predicate} order by c.id limit ${input.limit} offset ${input.offset}`),
      executor.execute(sql`select count(*) as total from assessment_marks_corrections c join ${assessments} on ${assessments.id}=c.assessment_id where ${predicate}`),
    ])
    return { items: page.rows.map(row => marksCorrectionSchema.parse(row.payload)), total: Number(count.rows[0]?.total ?? 0) }
  }
}
