import type { AssessmentDependenciesPort } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import type { RankingInput } from './report-rankings'
import { sql } from 'drizzle-orm'
import { transactionContext } from '../lib/transaction'
import { refreshReportRankings } from './report-rankings'

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
    // The workflow owns the academic lock. Published snapshots participate but never change.
    const { rows } = await this.executor().execute(sql`
      select r.id, jsonb_build_object(
        'mutable', r.status='draft' or r.revised_draft is not null,
        'revised', r.revised_draft is not null,
        'snapshot', coalesce(r.revised_draft, jsonb_build_object(
          'academicYearId', r.academic_year_id, 'periodId', r.period_id,
          'reportConfigurationRevision', r.report_configuration_revision,
          'overallAverage', r.overall_average, 'calculationStale', r.calculation_stale,
          'rank', r.rank, 'classSize', r.class_size, 'version', r.version, 'sectionResults', r.section_results
        ))) as payload
      from report_card_results r join class_groups c on c.id=r.class_group_id
      where c.school_id=${input.schoolId} and c.id=${input.classGroupId}
        and coalesce((r.revised_draft->>'gradingPolicyRevision')::integer, r.grading_policy_revision)=${input.policyRevision}`)
    const changes = refreshReportRankings(rows as RankingInput[])
    if (!changes.length)
      return
    await this.executor().execute(sql`
      update report_card_results r set
        rank=case when patch.revised then r.rank else patch.rank end,
        class_size=case when patch.revised then r.class_size else patch.size end,
        section_results=case when patch.revised then r.section_results else patch.sections end,
        version=case when patch.revised then r.version else patch.version end,
        revised_draft=case when patch.revised then r.revised_draft || jsonb_build_object(
          'rank', patch.rank, 'classSize', patch.size, 'sectionResults', patch.sections, 'version', patch.version
        ) else r.revised_draft end
      from jsonb_to_recordset(${JSON.stringify(changes)}::jsonb)
        as patch(id text, revised boolean, rank integer, size integer, sections jsonb, previous_version integer, version integer)
      where r.id=patch.id and coalesce((r.revised_draft->>'version')::integer, r.version)=patch.previous_version
        and (r.status='draft' or patch.revised)`)
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
