import type { AssessmentDependenciesPort } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { transactionContext } from '../lib/transaction'

interface ProjectionExecutor {
  execute: (query: SQL) => Promise<{ rows: Array<{ id?: unknown, payload?: unknown, total?: unknown }> }>
}

export class PostgresAssessmentDependencies implements AssessmentDependenciesPort {
  constructor(private readonly db: ProjectionExecutor) {}
  private executor(): ProjectionExecutor {
    return (transactionContext.getStore() as ProjectionExecutor | undefined) ?? this.db
  }

  async pendingGradingClass(input: { schoolId: string, gradeLevelId: string, academicYearId: string, policyRevision: number }): Promise<string | undefined> {
    const { rows } = await this.executor().execute(sql`
      select c.id from class_groups c join report_card_results r on r.class_group_id=c.id
      where c.school_id=${input.schoolId} and c.grade_level_id=${input.gradeLevelId} and c.academic_year_id=${input.academicYearId}
        and (coalesce((r.revised_draft->>'gradingPolicyRevision')::integer, r.grading_policy_revision, 0) <> ${input.policyRevision}
          or coalesce((r.revised_draft->>'calculationStale')::boolean, r.calculation_stale))
      order by c.id limit 1`)
    return rows[0]?.id === undefined ? undefined : String(rows[0].id)
  }

  async refreshGradingRankings(input: { schoolId: string, classGroupId: string, policyRevision: number }): Promise<void> {
    // Include published results in comparisons, but retain their publication snapshot.
    // Only drafts (including revised drafts) receive refreshed rankings.
    await this.executor().execute(sql`
      with candidates as (
        select r.id, r.period_id, r.revised_draft is not null as revised,
          case when r.revised_draft is not null then (r.revised_draft->>'overallAverage')::numeric else r.overall_average end as average
        from report_card_results r join class_groups c on c.id=r.class_group_id
        where c.school_id=${input.schoolId} and c.id=${input.classGroupId}
          and coalesce((r.revised_draft->>'gradingPolicyRevision')::integer, r.grading_policy_revision)=${input.policyRevision}
          and not coalesce((r.revised_draft->>'calculationStale')::boolean, r.calculation_stale)
      ), ranks as (
        select id, revised, rank() over (partition by period_id order by average desc) as rank,
          count(*) over (partition by period_id) as size from candidates where average is not null
      ) update report_card_results r set
        rank=case when ranks.revised or r.status='published' then r.rank else ranks.rank end,
        class_size=case when ranks.revised or r.status='published' then r.class_size else ranks.size end,
        revised_draft=case when ranks.revised then r.revised_draft || jsonb_build_object('rank', ranks.rank, 'classSize', ranks.size) else r.revised_draft end
      from ranks where r.id=ranks.id`)
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

  async publishedMarkIds(schoolId: string, ids: readonly string[]): Promise<Set<string>> {
    if (!ids.length)
      return new Set()
    const { rows } = await this.executor().execute(sql`
      select distinct source->>'resultId' as id from report_card_results r
      join students s on s.id=r.student_id
      cross join lateral jsonb_array_elements(r.source_marks) source
      where s.school_id=${schoolId} and r.status='published'
      and source->>'resultId' in (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`)
    return new Set(rows.map(row => String(row.id)))
  }

  async invalidateMarkDrafts(schoolId: string, ids: readonly string[]): Promise<void> {
    if (!ids.length)
      return
    await this.executor().execute(sql`update report_card_results r set revised_draft = r.revised_draft || jsonb_build_object('calculationStale', true, 'version', (r.revised_draft->>'version')::integer + 1, 'rank', null)
      from students s where s.id=r.student_id and s.school_id=${schoolId} and r.revised_draft is not null
      and exists (select 1 from jsonb_array_elements(r.revised_draft->'sourceMarks') source
        where source->>'resultId' in (${sql.join(ids.map(id => sql`${id}`), sql`, `)}))`)
    await this.executor().execute(sql`update report_card_results r set calculation_stale=true, version=version+1, rank=null
      from students s where s.id=r.student_id and s.school_id=${schoolId} and r.status='draft'
      and exists (select 1 from jsonb_array_elements(r.source_marks) source
        where source->>'resultId' in (${sql.join(ids.map(id => sql`${id}`), sql`, `)}))`)
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
      update report_card_results r set revised_draft = r.revised_draft || jsonb_build_object('calculationStale', true, 'version', (r.revised_draft->>'version')::integer + 1, 'rank', null)
      from students s where s.id=r.student_id and s.school_id=${input.schoolId} and r.revised_draft is not null
        and (r.revised_draft->'sourceAssessments' @> ${JSON.stringify([{ assessmentId: input.assessmentId }])}::jsonb
          or ((r.period_id=${input.periodId} or r.aggregation->'sourcePeriodIds' ? ${input.periodId})
            and exists (select 1 from student_class_enrollments e where e.student_id=r.student_id and e.class_group_id=${input.classGroupId})))`)

    await this.executor().execute(sql`
      update report_card_results r set calculation_stale = true, version = r.version + 1, rank = null
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
