import type { GuardianHighlights, GuardianHomePort, GuardianHomeScopes } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { compileResourceAccess } from '../lib/resource-access-scope'
import { transactionContext } from '../lib/transaction'
import * as tables from '../postgres-schema'

interface Executor { execute: (query: SQL) => Promise<{ rows: Record<string, unknown>[] }> }
type HighlightRow = Record<'absent' | 'late' | 'overdue' | 'balance' | 'reports' | 'unread' | 'surveys' | 'documents', number | string> & {
  marks: number | null
  progress: string | number | null
  due_date: string | null
  photo: string | null
  attendance: Record<string, string>
}

const sources = {
  attendance: tables.attendanceRecords,
  results: tables.reportCardResults,
  assessmentResults: tables.assessmentResults,
  studentCharges: tables.studentCharges,
  messageDeliveries: tables.messageDeliveries,
  studentPhotoSubmissions: tables.studentPhotoSubmissions,
  documentIssuances: tables.documentIssuances,
  classSubjects: tables.classSubjects,
  subjectEnrollments: tables.studentSubjectEnrollments,
}

export class PostgresGuardianHome implements GuardianHomePort {
  constructor(private readonly db: Executor) {}

  async highlights(input: Parameters<GuardianHomePort['highlights']>[0], scopes: GuardianHomeScopes): Promise<GuardianHighlights> {
    const db = transactionContext.getStore() as Executor | undefined ?? this.db
    const visible = (name: keyof typeof sources) => {
      const table = sources[name]
      const scope = scopes[name]
      return sql`select * from ${table} where ${scope ? compileResourceAccess(table, scope) : sql`false`}`
    }
    const student = input.studentId
    const start = input.start.toISOString()
    const end = input.end.toISOString()
    const now = input.now.toISOString()
    const { rows: [r] } = await db.execute(sql`with
      records as (select a.* from (${visible('attendance')}) a where a.student_id=${student}),
      day_status as (
        select coalesce(a.lesson_session_id,a.activity_session_id,a.assessment_id) id, a.status, a.date, a.id record_id from records a
        left join lesson_sessions l on l.id=a.lesson_session_id
        left join activity_sessions v on v.id=a.activity_session_id
        left join assessments t on t.id=a.assessment_id
        left join lesson_sessions linked on linked.id=t.lesson_session_id
        where coalesce(l.starts_at,v.starts_at,t.starts_at,linked.starts_at,t.due_at,a.date) >= ${start}::timestamp
          and coalesce(l.starts_at,v.starts_at,t.starts_at,linked.starts_at,t.due_at,a.date) < ${end}::timestamp
      ), charges as (
        select c.due_date, c.status, greatest(0,c.expected_amount-c.allocated_amount-c.adjustment_amount-c.waiver_amount) remaining
        from (${visible('studentCharges')}) c where c.student_id=${student} and c.academic_year_id=${input.academicYearId} and c.status<>'cancelled'
      ), reports as (select count(*)::int n from (${visible('results')}) r where r.student_id=${student} and r.status='published')
      select
        (select count(*)::int from records where status='absent') as absent,
        (select count(*)::int from records where status='late') as late,
        (select coalesce(jsonb_object_agg(id,status order by date,record_id),'{}') from day_status where id is not null) as attendance,
        (select count(*)::int from charges where status='overdue' or (remaining>0 and due_date < ${now}::timestamp)) as overdue,
        (select coalesce(sum(remaining),0) from charges) as balance,
        (select to_char(min(due_date),'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from charges where remaining>0) as due_date,
        (select n from reports) as reports,
        case when (select n from reports)=0 then (select count(*)::int from (${visible('assessmentResults')}) m where m.student_id=${student}) end as marks,
        (select count(*)::int from (${visible('messageDeliveries')}) d where d.subject_id=${input.subjectId} and d.status<>'read') as unread,
        (select p.status from (${visible('studentPhotoSubmissions')}) p where p.student_id=${student} order by p.created_at desc,p.id limit 1) as photo,
        (select count(*)::int from (${visible('documentIssuances')}) d where d.student_id=${student}
          and d.academic_year_id=${input.academicYearId} and d.status='ready' and d.template_key in (${sql.join(input.paperTemplates.map(key => sql`${key}`), sql`,`)})) as documents,
        ${input.classGroupId
          ? sql`(select round(avg(c.completed_percentage)) from (${visible('classSubjects')}) c
          where c.class_group_id=${input.classGroupId} and exists (
            select 1 from (${visible('subjectEnrollments')}) e join student_class_enrollments p on p.id=e.student_class_enrollment_id
            where p.student_id=${student} and p.academic_year_id=${input.academicYearId} and p.class_group_id=c.class_group_id
              and e.class_subject_id=c.id and e.deleted_at is null and e.enrolled_at<=${now}::timestamp
              and (e.ended_at is null or e.ended_at>${now}::timestamp)
              and (e.scope<>'periods' or exists (select 1 from jsonb_array_elements(e.periods) dates
                where (dates->>'activatedAt')::timestamptz<=${now}::timestamptz and (dates->>'startsAt')::timestamptz<=${now}::timestamptz
                  and (dates->>'endsAt')::timestamptz>${now}::timestamptz)))
          )`
          : sql`null`} as progress,
        (select count(*)::int from family_feedback_slots s join family_feedback_campaigns c on c.id=s.campaign_id
          where s.school_id=${input.schoolId} and c.school_id=${input.schoolId} and s.student_id=${student}
            and s.status<>'completed' and c.status='open' and exists (select 1 from student_class_enrollments e
              where e.student_id=s.student_id and e.class_group_id=c.class_group_id and e.academic_year_id=c.academic_year_id and e.status='active')) as surveys`)
    const row = r as HighlightRow
    const cards: GuardianHighlights['cards'] = { surveys: Number(row.surveys) }
    const unavailable: GuardianHighlights['unavailable'] = []
    if (scopes.attendance) {
      cards.absent = Number(row.absent)
      cards.late = Number(row.late)
    }
    else {
      unavailable.push('attendance')
    }
    if (scopes.studentCharges) {
      cards.overdue = Number(row.overdue)
      cards.balance = Number(row.balance)
      cards.dueDate = row.due_date ? String(row.due_date) : null
    }
    else {
      unavailable.push('fees')
    }
    if (scopes.results && (Number(row.reports) || scopes.assessmentResults)) {
      cards.reports = Number(row.reports)
      if (!cards.reports)
        cards.marks = Number(row.marks)
    }
    else {
      unavailable.push('results')
    }
    if (scopes.messageDeliveries)
      cards.unread = Number(row.unread)
    else unavailable.push('inbox')
    if (scopes.studentPhotoSubmissions && scopes.documentIssuances) {
      cards.photo = row.photo == null ? null : String(row.photo)
      cards.documents = Number(row.documents)
    }
    else {
      unavailable.push('child')
    }
    if (scopes.subjectEnrollments && scopes.classSubjects)
      cards.progress = row.progress == null ? null : Number(row.progress)
    else if (input.classGroupId)
      unavailable.push('progress')
    return { cards, attendance: scopes.attendance ? row.attendance : {}, unavailable }
  }
}
