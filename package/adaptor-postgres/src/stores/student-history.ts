import type { AttendanceHistoryScopes, GradeHistoryScopes, HistoryBoundary, ResourceAccessScope, StudentAttendanceHistoryInput, StudentGradeHistoryInput, StudentHistoryPort } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import { studentAttendanceHistoryRow, studentGradeHistoryPage, studentGradeHistoryRow } from '@edaya/core'
import { inArray, sql } from 'drizzle-orm'
import { compileResourceAccess } from '../lib/resource-access-scope'
import { transactionContext } from '../lib/transaction'
import * as s from '../postgres-schema'

interface Executor { execute: (query: SQL) => Promise<{ rows: Record<string, unknown>[] }> }
function visible(table: PgTable, scope: ResourceAccessScope | null) {
  return sql`(select * from ${table} where ${scope ? compileResourceAccess(table, scope) : sql`false`})`
}

function older(after?: HistoryBoundary) {
  return after ? sql`where (sort_key collate "C", id collate "C") < (${after.order}, ${after.id})` : sql``
}

const ordering = sql`sort_key collate "C" desc, id collate "C" desc`

const attendanceAnchors = studentAttendanceHistoryRow.omit({ label: true, time: true })
  .extend({ anchor: studentAttendanceHistoryRow.shape.id })
  .array()

export class PostgresStudentHistory implements StudentHistoryPort {
  constructor(private readonly db: Executor) {}

  async candidateCount(studentId: string, students: ResourceAccessScope, resource: 'attendance' | 'assessmentResults', cap: number) {
    const db = (transactionContext.getStore() as Executor | undefined) ?? this.db
    const table = resource === 'attendance' ? s.attendanceRecords : s.assessmentResults
    const { rows } = await db.execute(sql`
      select (select count(*)::int from (select 1 from ${table}
        where ${table.studentId} = ${s.students.id} limit ${cap}) candidates) as count
      from ${s.students} where ${s.students.id} = ${studentId} and ${compileResourceAccess(s.students, students)}`)
    if (!rows[0])
      return null
    const { count } = rows[0]
    return Number(count)
  }

  // The caller proves that every candidate fits on the first page in the same read snapshot.
  // Reading just the event types actually referenced avoids planning four large scope joins.
  async shortAttendanceHistory(studentId: string, scopes: AttendanceHistoryScopes) {
    const db = (transactionContext.getStore() as Executor | undefined) ?? this.db
    const { rows } = await db.execute(sql`
      select id, to_char(date,'YYYY-MM-DD') as date, status,
        case when attendance_id is not null then 'daily' when lesson_session_id is not null then 'lesson'
          when activity_session_id is not null then 'activity' else 'assessment' end as "eventKind",
        coalesce(attendance_id,lesson_session_id,activity_session_id,assessment_id) as anchor
      from ${s.attendanceRecords}
      where student_id = ${studentId} and ${compileResourceAccess(s.attendanceRecords, scopes.attendance)}
      order by id collate "C" desc`)
    const records = attendanceAnchors.parse(rows)
    const events = new Map<string, { label: string, date: string | null, time: string | null }>()
    const sources = [
      ['daily', s.attendances, scopes.attendances, s.attendances.displayLabel],
      ['lesson', s.lessonSessions, scopes.lessonSessions, s.lessonSessions.displayLabel],
      ['activity', s.activitySessions, scopes.activitySessions, s.activitySessions.displayLabel],
      ['assessment', s.assessments, scopes.assessments, s.assessments.title],
    ] as const
    for (const [kind, table, scope, label] of sources) {
      const ids = [...new Set(records.filter(row => row.eventKind === kind).map(row => row.anchor))]
      if (!ids.length || !scope)
        continue
      const batch = await db.execute(sql`
        select ${table.id} as id, ${label} as label, to_char(${table.startsAt},'YYYY-MM-DD') as date,
          to_char(${table.startsAt},'HH24:MI') as time from ${table}
        where ${inArray(table.id, ids)} and ${compileResourceAccess(table, scope)}`)
      for (const { id, label, date, time } of batch.rows)
        events.set(`${kind}:${id}`, { label: String(label), date: date == null ? null : String(date), time: time == null ? null : String(time) })
    }
    const totals = { present: 0, absent: 0, late: 0 }
    const items = records.map(({ anchor, ...row }) => {
      totals[row.status]++
      const event = events.get(`${row.eventKind}:${anchor}`)
      return { ...row, date: event?.date ?? row.date, time: event?.time ?? null, label: event?.label ?? null }
    })
    // Stable sort retains the database's bytewise descending ID order at equal display times.
    items.sort((a, b) => (b.date + (b.time ?? '')).localeCompare(a.date + (a.time ?? '')))
    return { ...totals, items, nextCursor: null }
  }

  async attendancePage(input: StudentAttendanceHistoryInput, scopes: AttendanceHistoryScopes, after?: HistoryBoundary) {
    const db = (transactionContext.getStore() as Executor | undefined) ?? this.db
    const limit = input.limit ?? 30
    const { rows } = await db.execute(sql`
      with records as (
        select id, date, status, attendance_id, lesson_session_id, activity_session_id, assessment_id
        from ${s.attendanceRecords}
        where student_id = ${input.studentId} and ${compileResourceAccess(s.attendanceRecords, scopes.attendance)}
      ), events as (
        select r.id, r.date as record_date, r.status,
          case when r.attendance_id is not null then 'daily' when r.lesson_session_id is not null then 'lesson'
            when r.activity_session_id is not null then 'activity' else 'assessment' end as "eventKind",
          coalesce(d.starts_at, l.starts_at, a.starts_at, e.starts_at) as starts_at,
          coalesce(d.display_label, l.display_label, a.display_label, e.title) as label
        from records r
        left join ${visible(s.attendances, scopes.attendances)} d on d.id = r.attendance_id
        left join ${visible(s.lessonSessions, scopes.lessonSessions)} l on l.id = r.lesson_session_id
        left join ${visible(s.activitySessions, scopes.activitySessions)} a on a.id = r.activity_session_id
        left join ${visible(s.assessments, scopes.assessments)} e on e.id = r.assessment_id
      ), dated as (
        select id, status, "eventKind", label, to_char(coalesce(starts_at, record_date), 'YYYY-MM-DD') as date,
          to_char(starts_at, 'HH24:MI') as time from events
      ), ordered as (
        select *, date || coalesce(time, '') as sort_key from dated
      ), page as (
        select * from ordered ${older(after)} order by ${ordering} limit ${limit + 1}
      )
      select count(*) filter (where status='present')::int as present,
        count(*) filter (where status='absent')::int as absent,
        count(*) filter (where status='late')::int as late,
        (select coalesce(jsonb_agg(to_jsonb(p) - 'sort_key' order by ${ordering}), '[]'::jsonb) from page p) as items
      from records`)
    const { items: pageRows, present, absent, late } = rows[0]!
    const page = studentAttendanceHistoryRow.array().parse(pageRows)
    const items = page.slice(0, limit)
    const last = items.at(-1)
    const nextCursor = last && page.length > limit ? JSON.stringify(['attendance', input.studentId, null, last.date + (last.time ?? ''), last.id]) : null
    return { present: Number(present), absent: Number(absent), late: Number(late), items, nextCursor }
  }

  async gradesPage(input: StudentGradeHistoryInput, scopes: GradeHistoryScopes, after?: HistoryBoundary) {
    const db = (transactionContext.getStore() as Executor | undefined) ?? this.db
    const limit = input.limit ?? 30
    const { rows } = await db.execute(sql`
      with pupil_marks as materialized (
        select id, assessment_id, score from ${s.assessmentResults}
        where student_id = ${input.studentId} and ${compileResourceAccess(s.assessmentResults, scopes.assessmentResults)}
      ), marks as (
        select r.id, a.id as "assessmentId", a.class_group_id as "classGroupId", a.title, a.kind,
          coalesce(sub.name, a.title) as subject, r.score, a.max_score as "outOf", a.coefficient,
          coalesce(to_char(coalesce(a.starts_at,a.due_at,a.completed_at,a.ends_at), 'YYYY-MM-DD'), '') as sort_key
        from pupil_marks r
        join lateral (
          select id, class_group_id, class_subject_id, title, kind, max_score, coefficient, starts_at, due_at, completed_at, ends_at
          from ${s.assessments} where id = r.assessment_id and ${compileResourceAccess(s.assessments, scopes.assessments)}
          limit 1
        ) a on true
        left join ${visible(s.classSubjects, scopes.classSubjects)} cs on cs.id = a.class_subject_id
        left join ${visible(s.subjects, scopes.subjects)} sub on sub.id = cs.subject_id
      ), totals as (
        select subject, grouping(subject) as whole, count(*)::int as total, count(score)::int as graded,
          sum(score * 20 * coefficient / nullif("outOf",0)) / nullif(sum(coefficient) filter (where score is not null),0) as average,
          max(sort_key) as latest
        from marks group by grouping sets ((), (subject))
      ), selected as (
        select * from marks ${input.subject === undefined ? sql`` : sql`where subject = ${input.subject}`}
      ), page as (
        select * from selected ${older(after)} order by ${ordering} limit ${limit + 1}
      )
      select total, graded, average::float8 as average,
        (select coalesce(jsonb_agg(to_jsonb(t) - 'whole' - 'latest' order by latest desc, subject collate "C"), '[]'::jsonb)
         from totals t where whole=0) as subjects,
        (select coalesce(jsonb_agg(to_jsonb(p) - 'sort_key' || jsonb_build_object('date',sort_key) order by ${ordering}), '[]'::jsonb)
         from page p) as items
      from totals where whole=1`)
    const { items: pageRows, ...totals } = rows[0]!
    const page = studentGradeHistoryRow.array().parse(pageRows)
    const items = page.slice(0, limit)
    const last = items.at(-1)
    const nextCursor = last && page.length > limit ? JSON.stringify(['grades', input.studentId, input.subject ?? null, last.date, last.id]) : null
    return studentGradeHistoryPage.parse({ ...totals, items, nextCursor })
  }
}
