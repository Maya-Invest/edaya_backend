import type { ClassRosterMembersInput, StudentDirectoryInput, StudentDirectoryPage, StudentDirectoryPort, StudentDirectoryScopes } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { compileResourceAccess } from '../lib/resource-access-scope'
import { transactionContext } from '../lib/transaction'
import * as tables from '../postgres-schema'

interface Executor { execute: (query: SQL) => Promise<{ rows: Record<string, unknown>[] }> }

const sources = {
  students: tables.students,
  enrollments: tables.studentClassEnrollments,
  classGroups: tables.classGroups,
  guardianLinks: tables.guardianStudentLinks,
  guardians: tables.guardians,
  attendance: tables.attendanceRecords,
  assessments: tables.assessments,
  assessmentResults: tables.assessmentResults,
  studentPhotoSubmissions: tables.studentPhotoSubmissions,
}

function matchingStudents(input: StudentDirectoryInput) {
  const search = input.view === 'class-roster' ? input.q : input.q?.trim()
  return sql`select s.* from students_allowed s where true
    ${input.status ? sql`and s.status=${input.status}` : sql``}
    ${search
      ? sql`and (strpos(lower(s.first_name||' '||s.last_name),lower(${search}))>0
      ${input.view === 'class-roster' ? sql`` : sql`or strpos(lower(btrim(s.identifier)),lower(${search}))>0`})`
      : sql``}
    ${input.classGroupId ? sql`and exists (select 1 from placements e where e.student_id=s.id and e.status='active' and e.class_group_id=${input.classGroupId})` : sql``}
    ${input.photoReview ? sql`and exists (select 1 from reviews f where f.student_id=s.id and f.status='pending')` : sql``}`
}

export class PostgresStudentDirectory implements StudentDirectoryPort {
  constructor(private readonly db: Executor) {}

  private executor() { return transactionContext.getStore() as Executor | undefined ?? this.db }

  async revision(schoolId: string): Promise<string> {
    const { rows: [row] } = await this.executor().execute(sql`select revision from student_directory_revisions where school_id=${schoolId}`)
    const { revision } = row ?? {}
    return String(revision ?? 'initial')
  }

  async page(input: StudentDirectoryInput, scopes: StudentDirectoryScopes): Promise<StudentDirectoryPage> {
    const { offset = 0, limit = 25, sort = 'roster' } = input
    const scoped = (resource: keyof StudentDirectoryScopes) => {
      const table = sources[resource]
      const scope = scopes[resource]
      return sql`select * from ${table} where ${scope ? compileResourceAccess(table, scope) : sql`false`}`
    }
    const classFilter = input.classGroupId ? sql`and e.class_group_id=${input.classGroupId}` : sql``
    const placement = sql`select e.id, e.class_group_id from placements e where e.student_id=s.id and e.status='active' ${classFilter} order by e.enrollment_index, e.id limit 1`
    const photo = sql`exists (select 1 from reviews f where f.student_id=s.id and f.status='pending')`
    const attendanceRate = sql`round(100.0 * count(*) filter (where a.status in ('present','late')) / nullif(count(*),0),1)`
    const attendance = sql`(select ${attendanceRate} from attendance a where a.student_id=s.id)`
    const weightedGrade = sql`round(sum(r.score*20 / (case when a.max_score>0 then a.max_score else 20 end) * a.coefficient)
      / nullif(sum(a.coefficient),0),2)`
    const gradeFilters = sql`r.score is not null
      ${input.view === 'class-roster' && !input.periodId ? sql`and false` : sql``}
      ${input.periodId ? sql`and a.period_id=${input.periodId}` : sql``}
      ${input.classGroupId && input.periodId ? sql`and a.class_group_id=${input.classGroupId}` : sql``}`
    const grade = !scopes.assessments || !scopes.assessmentResults
      ? sql`null::numeric`
      : sql`(select coalesce(${weightedGrade},0)
      from marks r join exams a on a.id=r.assessment_id where r.student_id=s.id and ${gradeFilters})`
    // Whole-school sorting needs each sort value once. Ordinary pages calculate
    // their optional metrics only after pagination.
    let sortJoin = sql``
    if (sort === 'class') {
      sortJoin = sql`left join (
        select distinct on (e.student_id) e.student_id, coalesce(g.name,e.class_group_id) as label
        from placements e left join groups_allowed g on g.id=e.class_group_id
        where e.status='active' ${classFilter}
        order by e.student_id, e.enrollment_index, e.id
      ) v on v.student_id=s.id`
    }
    else if (sort === 'average') {
      sortJoin = sql`left join (select r.student_id, ${weightedGrade} as average
        from marks r join exams a on a.id=r.assessment_id where ${gradeFilters}
        group by r.student_id) v on v.student_id=s.id`
    }
    else if (sort === 'attendance') {
      sortJoin = sql`left join (select a.student_id, ${attendanceRate} as rate from attendance a group by a.student_id) v on v.student_id=s.id`
    }
    const name = sql`(s.first_name || ' ' || s.last_name) collate edaya_directory_fr`
    const direction = input.sortDir === 'desc' ? sql`desc` : sql`asc`
    const keys = {
      name: sql`${name} ${direction}`,
      status: sql`s.status collate edaya_directory_fr ${direction}, ${name}`,
      class: sql`coalesce(s.sort_label,'') collate edaya_directory_fr ${direction}, ${name}`,
      average: sql`s.sort_grade ${direction}, ${name}`,
      attendance: sql`coalesce(s.sort_attendance,-1) ${direction}, ${name}`,
      roster: input.classGroupId ? sql`s.id` : sql`s.last_name, s.first_name`,
    }
    const ordering = sql`${keys[sort]}, s.id`
    const query = sql`with
      students_allowed as not materialized (${scoped('students')}),
      placements as not materialized (${scoped('enrollments')}),
      groups_allowed as not materialized (${scoped('classGroups')}),
      links as not materialized (${scoped('guardianLinks')}),
      guardians_allowed as not materialized (${scoped('guardians')}),
      attendance as not materialized (${scoped('attendance')}),
      exams as not materialized (${scoped('assessments')}),
      marks as not materialized (${scoped('assessmentResults')}),
      reviews as not materialized (${scoped('studentPhotoSubmissions')}),
      matching as not materialized (${matchingStudents(input)}), ranked as not materialized (
        select s.*,
          ${sort === 'class' ? sql`v.label` : sql`null::text`} as sort_label,
          ${sort === 'average' ? sql`coalesce(v.average,0)` : sql`null::numeric`} as sort_grade,
          ${sort === 'attendance' ? sql`v.rate` : sql`null::numeric`} as sort_attendance
        from matching s ${sortJoin}
      ), page as materialized (select s.* from ranked s order by ${ordering} limit ${limit} offset ${offset})
      select (select count(*)::int from matching) as total,
        (select coalesce(jsonb_agg(jsonb_build_object(
          'id', s.id, 'firstName', s.first_name, 'lastName', s.last_name, 'identifier', s.identifier, 'status', s.status,
          'sourceFullName', s.source_full_name, 'globalIdentifier', s.global_identifier,
          'placeOfBirth', s.place_of_birth, 'nationality', s.nationality, 'gender', s.gender, 'subjectId', s.subject_id,
          'birthdate', to_char(s.birth_date,'YYYY-MM-DD'), 'enrollmentDate', to_char(s.enrollment_date,'YYYY-MM-DD'),
          'enrollmentId', e.id, 'classId', e.class_group_id, 'guardianName', guardian.name,
          'photoAttachmentId', s.photo_attachment_id,
          'photoUrl', case when s.photo_url !~ '[?#]' then s.photo_url end,
          'pendingPhoto', ${photo}, 'average', ${sort === 'average' ? sql`s.sort_grade` : grade},
          'attendance', ${sort === 'attendance' ? sql`s.sort_attendance` : attendance}
        ) order by ${ordering}), '[]'::jsonb)
        from page s left join lateral (${placement}) e on true
        left join lateral (
          select g.first_name || ' ' || g.last_name as name from
            (select l.guardian_id from links l where l.student_id=s.id order by l.id limit 1) first_link
            join guardians_allowed g on g.id=first_link.guardian_id
        ) guardian on true) as items`
    const { rows: [result] } = await this.executor().execute(query)
    const { items, total } = result!
    return { rows: items as StudentDirectoryPage['rows'], total: Number(total), offset, limit }
  }

  async classRosterMemberIds(input: ClassRosterMembersInput, scopes: Pick<StudentDirectoryScopes, 'students' | 'enrollments'>) {
    const { rows } = await this.executor().execute(sql`with
      students_allowed as not materialized (select * from ${sources.students} where ${compileResourceAccess(sources.students, scopes.students)}),
      placements as not materialized (select * from ${sources.enrollments} where ${scopes.enrollments ? compileResourceAccess(sources.enrollments, scopes.enrollments) : sql`false`}),
      matching as not materialized (${matchingStudents({ ...input, view: 'class-roster' })})
      select id from matching order by id`)
    return rows.map(({ id }) => String(id))
  }
}
