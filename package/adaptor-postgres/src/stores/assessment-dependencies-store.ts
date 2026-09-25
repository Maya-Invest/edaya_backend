import type { AssessmentDependenciesPort } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { transactionContext } from '../lib/transaction'

interface ProjectionExecutor {
  execute: (query: SQL) => Promise<{ rows: Array<Record<string, unknown>> }>
}

export class PostgresAssessmentDependencies implements AssessmentDependenciesPort {
  constructor(private readonly db: ProjectionExecutor) {}
  private executor(): ProjectionExecutor {
    return (transactionContext.getStore() as ProjectionExecutor | undefined) ?? this.db
  }

  async reportAssessmentIds(schoolId: string, studentId: string, periodIds: readonly string[]): Promise<string[]> {
    const ids = new Set<string>()
    for (let start = 0; start < periodIds.length; start += 500) {
      const periods = periodIds.slice(start, start + 500)
      const result = await this.executor().execute(sql`
        select a.id from assessments a join class_groups c on c.id=a.class_group_id
        join students s on s.id=${studentId} and s.school_id=c.school_id
        where c.school_id=${schoolId} and a.period_id in (${sql.join(periods.map(id => sql`${id}`), sql`, `)})
          and (a.marks_review->'rosterStudentIds' ? ${studentId}
            or exists (select 1 from student_class_enrollments e where e.student_id=s.id and e.class_group_id=c.id))
      `)
      for (const { id } of result.rows) ids.add(String(id))
    }
    return [...ids]
  }

  async publishedAssessmentIds(schoolId: string, assessmentIds: readonly string[]): Promise<Set<string>> {
    if (!assessmentIds.length)
      return new Set()
    const rows = await this.executor().execute(sql`
      select distinct source->>'assessmentId' as id
      from report_card_results r
      join students s on s.id = r.student_id
      cross join lateral jsonb_array_elements(r.source_assessments) source
      where s.school_id = ${schoolId} and r.status = 'published'
        and source->>'assessmentId' in (${sql.join(assessmentIds.map(id => sql`${id}`), sql`, `)})
    `)
    return new Set(rows.rows.map(({ id }) => String(id)))
  }

  async invalidateDrafts(input: { schoolId: string, assessmentId: string, periodId: string, classGroupId: string }): Promise<void> {
    await this.executor().execute(sql`
      update report_card_results r set calculation_stale = true, version = r.version + 1
      from students s
      where s.id = r.student_id and s.school_id = ${input.schoolId} and r.status = 'draft'
        and (
          r.source_assessments @> ${JSON.stringify([{ assessmentId: input.assessmentId }])}::jsonb
          or ((r.period_id = ${input.periodId} or r.aggregation->'sourcePeriodIds' ? ${input.periodId})
            and exists (select 1 from student_class_enrollments e where e.student_id = r.student_id and e.class_group_id = ${input.classGroupId}))
        )
    `)
  }
}
