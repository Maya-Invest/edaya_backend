/* eslint-disable dot-notation -- SQL result and filter dictionaries have explicit index signatures. */
import type { AppShellCounts, DashboardClassRiskRow, DashboardProjectionPort, DashboardScopes, DashboardUpcomingItem, GetSchoolOverviewInput, SchoolOverview } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import { BusinessRuleViolationError } from '@edaya/core'
import { sql } from 'drizzle-orm'
import { chargeAgingCtes } from '../lib/charge-aging'
import { compileResourceAccess } from '../lib/resource-access-scope'
import { transactionContext } from '../lib/transaction'
import * as tables from '../postgres-schema'

interface Executor { execute: (query: SQL) => Promise<{ rows: Array<Record<string, unknown>> }> }
const resources = {
  students: tables.students,
  guardians: tables.guardians,
  staffMembers: tables.staffMembers,
  teachers: tables.teachers,
  studentCharges: tables.studentCharges,
  results: tables.reportCardResults,
  incidents: tables.incidents,
  attendance: tables.attendanceRecords,
  assessments: tables.assessments,
  assessmentResults: tables.assessmentResults,
  enrollments: tables.studentClassEnrollments,
  calendarEvents: tables.calendarEvents,
  classGroups: tables.classGroups,
  payments: tables.payments,
  studentDisciplinaryActions: tables.studentDisciplinaryActions,
  activities: tables.activities,
  academicPeriods: tables.academicPeriods,
} as const
const n = (row: Record<string, unknown>, key: string) => Number(row[key] ?? 0)
const rate = (present: number, total: number) => total ? Math.round(1000 * present / total) / 10 : null

/** Every source is scoped before joins/counts; only totals, class rows and 14 events leave SQL. */
export class PostgresDashboardProjections implements DashboardProjectionPort {
  constructor(private readonly db: Executor) {}
  private executor(): Executor { return transactionContext.getStore() as Executor | undefined ?? this.db }
  private source(resource: keyof DashboardScopes, scope: DashboardScopes, extra: SQL = sql`true`): SQL {
    const table = resources[resource]
    return sql`select * from ${table} where ${compileResourceAccess(table, scope[resource])} and ${extra}`
  }

  async appShell(input: { schoolId: string, classGroupIds?: readonly string[] }, scopes: DashboardScopes): Promise<AppShellCounts> {
    const ids = [...new Set(input.classGroupIds ?? [])]
    const counts = await this.executor().execute(sql`
      select (select count(*) from (${this.source('students', scopes)}) s) as students,
        (select count(*) from (${this.source('guardians', scopes)}) g) as guardians,
        (select count(*) from (${this.source('staffMembers', scopes)}) m) as staff,
        (select count(*) from (${this.source('teachers', scopes)}) t) as teachers
    `)
    const row = counts.rows[0]!
    const activeEnrollmentCountsByClass = Object.fromEntries(ids.map(id => [id, 0]))
    // Bound parameters and avoid returning individual enrollment records.
    for (let start = 0; start < ids.length; start += 500) {
      const chunk = ids.slice(start, start + 500)
      const found = await this.executor().execute(sql`
        select class_group_id, count(*) as count from (${this.source('enrollments', scopes, sql`${tables.studentClassEnrollments.status} = 'active' and ${tables.studentClassEnrollments.classGroupId} in (${sql.join(chunk.map(id => sql`${id}`), sql`, `)})`)}) e
        group by class_group_id
      `)
      for (const value of found.rows) activeEnrollmentCountsByClass[String(value['class_group_id'])] = n(value, 'count')
    }
    return { schoolId: input.schoolId, activeEnrollmentCountsByClass, studentCount: n(row, 'students'), guardianCount: n(row, 'guardians'), staffCount: n(row, 'staff'), teacherCount: n(row, 'teachers') }
  }

  async overview(input: GetSchoolOverviewInput, scopes: DashboardScopes): Promise<Omit<SchoolOverview, 'actionItems'>> {
    const at = input.referenceDate ?? new Date()
    const day = at.toISOString().slice(0, 10)
    const until = new Date(`${day}T00:00:00.000Z`)
    until.setUTCDate(until.getUTCDate() + 7)
    const recent = new Date(at.getTime() - 6 * 86400000)
    const year = input.academicYearId
    const period = input.academicPeriodId ?? null
    const common = sql`
      with selected_year as (select start_date, end_date from academic_years where id = ${year} and school_id = ${input.schoolId}),
      s as (${this.source('students', scopes)}),
      staff as (${this.source('staffMembers', scopes)}),
      classes as (${this.source('classGroups', scopes, sql`${tables.classGroups.academicYearId} = ${year}`)}),
      enrollments as (${this.source('enrollments', scopes, sql`${tables.studentClassEnrollments.academicYearId} = ${year}`)}),
      active as (select distinct student_id, class_group_id from enrollments where status = 'active' and student_id in (select id from s)),
      ${chargeAgingCtes(this.source('studentCharges', scopes, sql`${tables.studentCharges.academicYearId} = ${year}`), at)},
      attendance as (${this.source('attendance', scopes, sql`${tables.attendanceRecords.date} >= (select start_date from selected_year) and ${tables.attendanceRecords.date} < (select end_date + interval '1 day' from selected_year) and ((${tables.attendanceRecords.date} >= ${day}::timestamp and ${tables.attendanceRecords.date} < ${day}::timestamp + interval '1 day') or ${tables.attendanceRecords.justificationStatus} = 'pending')`)}),
      today as (select * from attendance where date >= ${day}::timestamp and date < ${day}::timestamp + interval '1 day'),
      incidents as (${this.source('incidents', scopes, sql`${tables.incidents.status} = 'open' and ${tables.incidents.date} >= (select start_date from selected_year) and ${tables.incidents.date} < (select end_date + interval '1 day' from selected_year)`)}),
      evaluations as (${this.source('assessments', scopes, sql`${tables.assessments.periodId} = ${period}`)}),
      marks as (${this.source('assessmentResults', scopes, sql`${tables.assessmentResults.assessmentId} in (select id from evaluations)`)}),
      eligible as (
        select a.id, a.class_group_id, e.student_id from evaluations a join enrollments e on e.class_group_id = a.class_group_id
        left join ${tables.lessonSessions} l on l.id = a.lesson_session_id
        where a.marks_status = 'draft' and e.enrolled_at <= coalesce(a.due_at,a.starts_at,l.starts_at)
          and (e.ended_at is null or e.ended_at > coalesce(a.due_at,a.starts_at,l.starts_at))
        union
        select a.id, a.class_group_id, jsonb_array_elements_text(coalesce(a.marks_review->'rosterStudentIds', '[]'::jsonb)) from evaluations a where a.marks_status <> 'draft'
      ),
      grading as (select e.id, e.class_group_id, count(*) as expected,
        count(*) filter (where exists (select 1 from marks m where m.assessment_id=e.id and m.student_id=e.student_id and (m.score is not null or m.designation in ('absent','exempt')))) as completed
        from eligible e where e.student_id in (select id from s) group by e.id,e.class_group_id),
      reports as (${this.source('results', scopes, sql`${tables.reportCardResults.periodId} = ${period}`)}),
      payments as (${this.source('payments', scopes, sql`${tables.payments.academicYearId} = ${year} and ${tables.payments.status} = 'recorded' and ${tables.payments.kind} = 'receipt' and ${tables.payments.paymentDate} between ${recent.toISOString()}::timestamp and ${at.toISOString()}::timestamp`)}),
      discipline as (${this.source('studentDisciplinaryActions', scopes, sql`${tables.studentDisciplinaryActions.status} = 'active' and ${tables.studentDisciplinaryActions.incidentId} in (select id from ${tables.incidents} where school_id = ${input.schoolId} and date >= (select start_date from selected_year) and date < (select end_date + interval '1 day' from selected_year)) and (${tables.studentDisciplinaryActions.startsAt} is null or ${tables.studentDisciplinaryActions.startsAt} <= ${at.toISOString()}::timestamp) and (${tables.studentDisciplinaryActions.endsAt} is null or ${tables.studentDisciplinaryActions.endsAt} >= ${at.toISOString()}::timestamp)`)}),
      activities as (${this.source('activities', scopes, sql`${tables.activities.endDate} >= ${at.toISOString()}::timestamp and ${tables.activities.startDate} < ${until.toISOString()}::timestamp`)})
    `
    const totalsQuery = sql`select
      coalesce(nullif((select count(distinct student_id) from active),0),(select count(*) from s)) as students,
      (select count(*) from staff) as staff,
      (select count(*) from overdue) as overdue_count, (select coalesce(sum(amount),0) from overdue) as overdue_amount,
      (select count(*) from reports where status='published') as published,
      (select count(distinct student_id) from reports where status='published') as published_students,
      (select count(*) from today) as attendance, (select count(*) from today where status='present') as present,
      (select count(*) from today where status='absent') as absent,
      (select count(*) from attendance where justification_status='pending') as justifications,
      (select count(*) from incidents) as incidents,
      (select count(*) from incidents where kind in ('major_infraction','emergency')) as severe,
      (select count(distinct class_group_id) from grading where completed<expected) as incomplete,
      (select coalesce(sum(expected),0) from grading) as expected, (select coalesce(sum(completed),0) from grading) as completed,
      (select count(distinct student_id) from charges where status in ('pending','partial','overdue') and expected_amount-adjustment_amount-waiver_amount-allocated_amount>0) as balance,
      (select count(*) from payments) as payments, (select coalesce(sum(amount),0) from payments) as paid,
      (select count(*) from discipline) as discipline, (select count(*) from activities) as activities,
      (select count(*) from charges where currency is distinct from (select finance_currency from schools where id=${input.schoolId})) as currency_conflicts
    `
    const classRowsQuery = sql`with
      attendance_by_class as (select e.class_group_id, count(*) as attendance, count(*) filter (where t.status='present') as present from today t join active e on e.student_id=t.student_id group by e.class_group_id),
      incidents_by_class as (select class_group_id, count(*) as incidents, count(*) filter (where kind in ('major_infraction','emergency')) as severe from incidents group by class_group_id),
      grading_by_class as (select class_group_id, sum(expected) as expected, sum(completed) as completed from grading group by class_group_id),
      overdue_by_class as (select e.class_group_id, count(*) as overdue from overdue o join active e on e.student_id=o.student_id group by e.class_group_id)
      select c.id,c.name,trim(staff.first_name || ' ' || staff.last_name) as coordinator,
        a.attendance,a.present,i.incidents,i.severe,g.expected,g.completed,o.overdue
      from classes c left join staff on staff.id=c.homeroom_staff_id
        left join attendance_by_class a on a.class_group_id=c.id
        left join incidents_by_class i on i.class_group_id=c.id
        left join grading_by_class g on g.class_group_id=c.id
        left join overdue_by_class o on o.class_group_id=c.id
    `
    const eventsQuery = sql`with calendar as (${this.source('calendarEvents', scopes, sql`${tables.calendarEvents.academicYearId}=${year} and ${tables.calendarEvents.startDate}>=${day}::timestamp and ${tables.calendarEvents.startDate}<${until.toISOString()}::timestamp`)}), period as (${this.source('academicPeriods', scopes, sql`${tables.academicPeriods.id}=${period}`)})
      select * from (
        select id,start_date::date::text as date,title,case when is_non_school_day then 'holiday' else 'calendar' end as kind,is_non_school_day as highlight from calendar
        union all select id,due_date::date::text,'Fee payment due','fee_due',false from charges where status not in ('cancelled','paid','waived') and due_date>=${day}::timestamp and due_date<${until.toISOString()}::timestamp
        union all select 'period-end-'||id,end_date::date::text,name||' report cards due','report_card_deadline',true from period where end_date>=${day}::timestamp and end_date<${until.toISOString()}::timestamp
        union all select id,coalesce(due_at,starts_at)::date::text,title,'exam',false from evaluations where coalesce(due_at,starts_at)>=${day}::timestamp and coalesce(due_at,starts_at)<${until.toISOString()}::timestamp
      ) events order by date,title,id limit 14
    `
    // Share scoped source CTEs and one database snapshot across totals, risk rows and events.
    const result = await this.executor().execute(sql`${common},
      totals as (${totalsQuery}), class_rows as (${classRowsQuery}), upcoming_events as (${eventsQuery})
      select (select to_jsonb(t) from totals t) as totals,
        (select coalesce(jsonb_agg(c),'[]'::jsonb) from class_rows c) as classes,
        (select coalesce(jsonb_agg(e order by e.date,e.title,e.id),'[]'::jsonb) from upcoming_events e) as events
    `)
    const envelope = result.rows[0]!
    const v = envelope['totals'] as Record<string, unknown>
    if (n(v, 'currency_conflicts'))
      throw new BusinessRuleViolationError('CURRENCY_MISMATCH', 'Dashboard charges must use the configured school currency')
    const rows = { rows: envelope['classes'] as Record<string, unknown>[] }
    const events = { rows: envelope['events'] as Record<string, unknown>[] }
    const classRiskRows: DashboardClassRiskRow[] = rows.rows.map((row): DashboardClassRiskRow => {
      const attendanceRateToday = rate(n(row, 'present'), n(row, 'attendance'))
      const gradingCompletionPercent = rate(n(row, 'completed'), n(row, 'expected'))
      const openIncidentCount = n(row, 'incidents')
      const severe = n(row, 'severe')
      const overdueFeeCount = n(row, 'overdue')
      const riskLevel = severe || (attendanceRateToday !== null && attendanceRateToday < 75) || (gradingCompletionPercent !== null && gradingCompletionPercent < 60) || overdueFeeCount >= 3
        ? 'needs_action'
        : openIncidentCount || (attendanceRateToday !== null && attendanceRateToday < 90) || (gradingCompletionPercent !== null && gradingCompletionPercent < 85) || overdueFeeCount ? 'watch' : 'normal'
      return { classGroupId: String(row['id']), className: String(row['name']), coordinatorName: row['coordinator'] === null ? null : String(row['coordinator']), attendanceRateToday, gradingCompletionPercent, openIncidentCount, overdueFeeCount, riskLevel }
    }).sort((a, b) => ({ needs_action: 0, watch: 1, normal: 2 }[a.riskLevel] - { needs_action: 0, watch: 1, normal: 2 }[b.riskLevel]) || a.className.localeCompare(b.className))
    const upcoming = events.rows.map(row => ({ id: String(row['id']), date: String(row['date']), title: String(row['title']), kind: row['kind'] as DashboardUpcomingItem['kind'], highlight: row['highlight'] === true }))
    const kpis = { studentCount: n(v, 'students'), staffCount: n(v, 'staff'), overdueFeeCount: n(v, 'overdue_count'), overdueFeeAmount: n(v, 'overdue_amount'), publishedReportCardCount: period ? n(v, 'published') : null, unpublishedReportCardCount: period ? Math.max(0, n(v, 'students') - n(v, 'published_students')) : null, attendanceRateToday: rate(n(v, 'present'), n(v, 'attendance')), absencesToday: n(v, 'absent'), openIncidentCount: n(v, 'incidents'), highSeverityIncidentCount: n(v, 'severe'), pendingJustificationCount: n(v, 'justifications'), incompleteGradingClassCount: period ? n(v, 'incomplete') : null }
    return { schoolId: input.schoolId, academicYearId: year, academicPeriodId: period, referenceDate: day, generatedAt: new Date().toISOString(), kpis, upcoming, classRiskRows, areaHealth: { students: { attendanceRateToday: kpis.attendanceRateToday, absencesToday: kpis.absencesToday, pendingJustifications: kpis.pendingJustificationCount }, academics: { gradingCompletionPercent: rate(n(v, 'completed'), n(v, 'expected')), publishedReportCards: kpis.publishedReportCardCount, totalReportCards: period ? kpis.studentCount : null, incompleteGradingClassCount: kpis.incompleteGradingClassCount }, finance: { overdueAmount: kpis.overdueFeeAmount, studentsWithBalance: n(v, 'balance'), recentPaymentCount: n(v, 'payments'), recentPaymentAmount: n(v, 'paid') }, schoolLife: { openIncidentCount: kpis.openIncidentCount, highSeverityIncidentCount: kpis.highSeverityIncidentCount, activeActivityCount: n(v, 'activities'), unresolvedDisciplineCount: n(v, 'discipline') } } }
  }
}
