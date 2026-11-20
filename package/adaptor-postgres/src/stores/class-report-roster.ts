import type { ClassReportRosterInput, ClassReportRosterPort, ClassReportRosterScopes } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import { classReportRosterPage, classReportRosterPageSize } from '@edaya/core'
import { sql } from 'drizzle-orm'
import { compileResourceAccess } from '../lib/resource-access-scope'
import { transactionContext } from '../lib/transaction'
import { reportCardResults, studentClassEnrollments, students, teacherWorkflowStates } from '../postgres-schema'

interface Executor { execute: (query: SQL) => Promise<{ rows: Record<string, unknown>[] }> }
const projection = classReportRosterPage.omit({ nextCursor: true })

// A saved section is either the plain stored section or a serialized domain section.
function sectionNodes(source: SQL) {
  return sql`select nodes.node,
      (nullif(root.node->>'classSubjectId','') is not null or exists (
        select 1 from jsonb_array_elements(raw->'subResults') child
        where nullif(coalesce(child->'data', child)->>'classSubjectId','') is not null
      )) as has_marks
    from jsonb_array_elements(${source}) raw
    cross join lateral (select coalesce(raw->'data',raw) as node) root
    cross join lateral (select root.node as node union all
      select coalesce(child->'data',child) from jsonb_array_elements(raw->'subResults') child) nodes`
}

function reportSummaries(scopes: ClassReportRosterScopes, input: ClassReportRosterInput) {
  const subjectIds = JSON.stringify(scopes.subjectIds)
  const needsHomeroom = scopes.homeroom || !scopes.isTeacher
  // A legacy correction replaces the visible result. Graded and annual cards retain
  // current grades and section structure, with saved comments matched by section ID.
  return sql`authorized as (
    select report_card_results.*, ${teacherWorkflowStates.payload}->'payload'->'visibleSnapshot' as saved
    from ${reportCardResults} left join ${teacherWorkflowStates}
      on target_id=report_card_results.id and workflow='report_comments' and school_id=${scopes.results.schoolId}
    where class_group_id=${input.classGroupId} and period_id=${input.periodId} and academic_year_id=${scopes.academicYearId}
      and ${compileResourceAccess(reportCardResults, scopes.results)}
  ), revisions as (
    select *, saved is not null and grading is null and revised_draft is null and grading_policy_revision is null
      and (aggregation->>'source') is distinct from 'report_cards' as legacy from authorized
  ), visible as (
    select id, student_id,
      case when legacy then saved->>'status' else status end as status,
      case when legacy then (saved->>'overallAverage')::numeric else overall_average end as average,
      case when legacy then saved->'grading' else grading end as grading,
      case when legacy then saved->>'aggregateLabel' else aggregate_label end as label,
      case when legacy then (saved->>'rank')::int else rank end as rank,
      case when legacy then (saved->>'classSize')::int else class_size end as class_size,
      coalesce((case when saved is not null then saved->>'teacherComment' else teacher_comment end) ~ '[^[:space:]]',false) as has_comment,
      case when legacy then saved->'sectionResults' else section_results end as sections,
      case when not legacy then saved->'sectionResults' end as corrected_sections
    from revisions
  ), summaries as (
    select id, student_id, status, average, grading, label, rank, class_size, has_comment,
      (${needsHomeroom} and not has_comment)::int + metrics.missing_comments as remaining,
      (rank is null or rank < 1 or class_size is null or class_size < rank or (grading is null and average is null)
        or coalesce(metrics.missing_values,false)) as missing_values,
      ((grading is null and average is not null) or coalesce(metrics.missing_grading,false)) as missing_grading
    from visible
    cross join lateral (
      select count(*) filter (where (
          (current.node->>'sectionKind'='module' and ${needsHomeroom}) or
          (current.node->>'sectionKind'='subject' and (${!scopes.isTeacher} or ${subjectIds}::jsonb ? (current.node->>'classSubjectId')))
        ) and not coalesce((case when corrections.comments ? (current.node->>'sectionId')
            then corrections.comments->>(current.node->>'sectionId') else current.node->>'comment' end) ~ '[^[:space:]]',false))::int as missing_comments,
        bool_or(current.has_marks and (current.node->>'grading') is null and (current.node->>'average') is null) as missing_values,
        bool_or(current.has_marks and (current.node->>'grading') is null and (current.node->>'average') is not null) as missing_grading
      from (${sectionNodes(sql`visible.sections`)}) current
      cross join lateral (
        select jsonb_object_agg(fixed.node->>'sectionId',fixed.node->'comment') as comments
        from (${sectionNodes(sql`visible.corrected_sections`)}) fixed
      ) corrections
    ) metrics
  )`
}

const totals = sql`(select jsonb_build_object(
  'generatedCount', count(*), 'publishedCount', count(*) filter (where status='published'),
  'commentFilledCount', count(*) filter (where remaining=0), 'remainingFields', coalesce(sum(remaining),0))
  from summaries) as totals`

export class PostgresClassReportRoster implements ClassReportRosterPort {
  constructor(private readonly db: Executor) {}

  async read(scopes: ClassReportRosterScopes, input: ClassReportRosterInput, after?: { name: string, id: string }) {
    const db = (transactionContext.getStore() as Executor | undefined) ?? this.db
    const summaries = reportSummaries(scopes, input)
    if (input.view === 'summary') {
      const { rows } = await db.execute(sql`with ${summaries} select ${totals}`)
      return projection.parse({ ...rows[0], items: [], matchedPupils: 0, missingValues: false, missingGrading: false })
    }

    const status = input.status === 'none'
      ? sql`report.id is null`
      : input.status ? sql`report.status=${input.status}` : sql`true`
    const { rows } = await db.execute(sql`with ${summaries}, pupils as (
      select students.id, coalesce(nullif(trim(first_name || ' ' || last_name),''), students.id) collate edaya_directory_fr as name,
        photo_url from ${students}
      where ${compileResourceAccess(students, scopes.students)} and exists (
        select 1 from ${studentClassEnrollments}
        where student_id=students.id and class_group_id=${input.classGroupId} and academic_year_id=${scopes.academicYearId}
          and status='active' and ${compileResourceAccess(studentClassEnrollments, scopes.enrollments)})
    ), pupil_reports as (
      select distinct on (student_id) * from summaries order by student_id, id ${scopes.isTeacher ? sql`desc` : sql`asc`}
    ), matching as (
      select pupils.*, report.id as report_id, report.status, has_comment, average, grading, label, rank, class_size
      from pupils left join pupil_reports report on report.student_id=pupils.id
      where ${status} ${input.q ? sql`and strpos(lower(pupils.name),lower(${input.q}))>0` : sql``}
    ), page as (
      select * from matching ${after ? sql`where (name,id)>(${after.name},${after.id})` : sql``}
      order by name,id limit ${classReportRosterPageSize + 1}
    )
    select ${totals}, (select count(*)::int from matching) as "matchedPupils",
      coalesce((select bool_or(missing_values) from summaries join matching on matching.id=summaries.student_id),false) as "missingValues",
      coalesce((select bool_or(missing_grading) from summaries join matching on matching.id=summaries.student_id),false) as "missingGrading",
      coalesce((select jsonb_agg(jsonb_build_object('studentId',id,'studentName',name,'photoUrl',photo_url,
        'report',case when report_id is not null then jsonb_build_object('id',report_id,'status',status,
          'hasComment',has_comment,'overallAverage',case when grading is null then round(average,2) else average end,
          'grading',grading,'aggregateLabel',label,'rank',rank,'classSize',class_size) end) order by name,id) from page),'[]'::jsonb) as items`)
    return projection.parse(rows[0])
  }
}
