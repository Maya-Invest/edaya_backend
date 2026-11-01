import type { SQL } from 'drizzle-orm'
import { PostgresDashboardProjections } from '@edaya/adaptor-postgres'
import { expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { fixture } from './support/marks-fixture'

test('native dashboard upcoming uses saved labels, unpaid installments and a rolling seven-day window', async () => {
  const f = await fixture('dashboard-upcoming')
  const db = f.handles[0]!.db as { execute: (query: SQL) => Promise<{ rows: Record<string, unknown>[] }> }
  const input = { schoolId: f.id('school'), academicYearId: f.id('year'), academicPeriodId: f.id('period'), referenceDate: new Date('2026-10-27T12:00:00Z') }
  for (const [id, date, status, allocated, installments] of [
    ['today', '2026-10-27', 'pending', 0, []],
    ['last-day', '2026-11-02', 'pending', 0, []],
    ['outside', '2026-11-03', 'pending', 0, []],
    ['past', '2026-10-26', 'pending', 0, []],
    ['paid', '2026-10-28', 'paid', 10000, []],
    ['settled', '2026-10-28', 'partial', 10000, []],
    ['cancelled', '2026-10-28', 'cancelled', 0, []],
    ['installments', '2026-10-01', 'partial', 5000, [
      { id: 'first', label: 'Première tranche', expectedAmount: 5000, dueDate: '2026-10-01' },
      { id: 'second', label: 'Deuxième tranche', expectedAmount: 5000, dueDate: '2026-10-29' },
    ]],
  ] as const) {
    await db.execute(sql`insert into catalog_services (id,school_id,academic_year_id,name,category,auto_billing,billing_kind,default_price,currency,billing_terms,status,created_at)
      values (${f.id(`catalog-${id}`)},${f.id('school')},${f.id('year')},${`Scolarité ${id}`},'tuition','{"mode":"off"}'::jsonb,'one_time',10000,'XOF','{"kind":"one_time","installments":[]}'::jsonb,'active',now())`)
    await db.execute(sql`insert into student_service_enrollments (id,school_id,student_id,catalog_service_id,academic_year_id,status,source,accepted_terms,enrolled_at,created_at)
      values (${f.id(`service-${id}`)},${f.id('school')},${f.id('student')},${f.id(`catalog-${id}`)},${f.id('year')},'active','manual','{}'::jsonb,'2026-01-01',now())`)
    await db.execute(sql`insert into student_charges (id,school_id,student_id,enrollment_id,academic_year_id,label,expected_amount,allocated_amount,adjustment_amount,waiver_amount,currency,due_date,status,installments,created_at)
      values (${f.id(id)},${f.id('school')},${f.id('student')},${f.id(`service-${id}`)},${f.id('year')},${`Scolarité ${id}`},10000,${allocated},0,0,'XOF',${date}::timestamp,${status},${JSON.stringify(installments)}::jsonb,now())`)
  }
  for (const [id, date, year] of [
    ['meeting', '2026-10-28', f.id('year')],
    ['old-event', '2026-10-26', f.id('year')],
    ['later-event', '2026-11-03', f.id('year')],
    ['other-year', '2026-10-28', 'other-year'],
  ] as const) {
    await db.execute(sql`insert into calendar_events (id,school_id,academic_year_id,title,start_date,end_date,kind,is_non_school_day,scope_kind,created_at)
      values (${f.id(id)},${f.id('school')},${year},${`Réunion ${id}`},${date}::timestamp,${date}::timestamp,'event',false,'school',now())`)
  }
  await db.execute(sql`update academic_periods set end_date='2026-10-30',name='Trimestre 1' where id=${f.id('period')}`)
  const overview = await f.editor.getSchoolOverview(input)
  expect(overview.upcoming.map(item => [item.id, item.date, item.title, item.kind])).toEqual([
    [f.id('today'), '2026-10-27', 'Scolarité today', 'fee_due'],
    [f.id('meeting'), '2026-10-28', 'Réunion meeting', 'calendar'],
    [f.id('installments'), '2026-10-29', 'Scolarité installments', 'fee_due'],
    [`period-end-${f.id('period')}`, '2026-10-30', 'Trimestre 1', 'report_card_deadline'],
    [f.id('last-day'), '2026-11-02', 'Scolarité last-day', 'fee_due'],
  ])
  await db.execute(sql`update student_charges set label='Transport novembre' where id=${f.id('today')}`)
  await db.execute(sql`update student_charges set allocated_amount=10000,status='paid' where id=${f.id('installments')}`)
  await f.r.calendarEvents.delete(f.id('meeting'))
  const refreshed = await f.editor.getSchoolOverview(input)
  expect(refreshed.upcoming.map(item => item.title)).toEqual(['Transport novembre', 'Trimestre 1', 'Scolarité last-day'])
  const nextWeek = await f.editor.getSchoolOverview({ ...input, referenceDate: new Date('2026-11-03') })
  expect(nextWeek.upcoming.map(item => item.id)).toEqual([f.id('later-event'), f.id('outside')])
  const scopes = await f.editor.baseService.access.overview.scopes()
  const restricted = await new PostgresDashboardProjections(db).overview(input, {
    ...scopes,
    studentCharges: { ...scopes.studentCharges, clauses: [] },
    calendarEvents: { ...scopes.calendarEvents, clauses: [] },
  })
  expect(restricted.upcoming.map(item => item.kind)).toEqual(['report_card_deadline'])
})
