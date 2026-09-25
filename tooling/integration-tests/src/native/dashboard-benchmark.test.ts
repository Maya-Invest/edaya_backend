import type { SQL } from 'drizzle-orm'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { PostgresDashboardProjections } from '@edaya/adaptor-postgres'
import { expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { buildSchoolOverview as referenceOverview } from '../../../../package/domain-service/tests/support/overview-reference'
import { fixture } from './support/marks-fixture'

const output = process.env.EDAYA_BENCHMARK_OUTPUT
const evidence: unknown[] = []
const benchmark = output ? test : test.skip
for (const size of [30, 300, 3000]) {
  benchmark(`dashboard projection benchmark ${size} students`, async () => {
    const f = await fixture(`benchmark-${size}`)
    const db = f.handles[0]!.db as { execute: (query: SQL) => Promise<{ rows: Record<string, unknown>[] }> }
    // Thirty students per class, one approved sheet and one partially settled charge per student.
    await db.execute(sql`insert into class_groups (id,school_id,academic_year_id,grade_level_id,name,created_at)
      select ${f.id('cohort-')}||i,${f.id('school')},${f.id('year')},${f.id('grade')},'Class '||i,now() from generate_series(1,${Math.ceil(size / 30)}) i`)
    await db.execute(sql`insert into students (id,school_id,first_name,last_name,status,created_at)
      select ${f.id('pupil-')}||i,${f.id('school')},'Student',i::text,'active',now() from generate_series(1,${size}) i`)
    await db.execute(sql`insert into student_class_enrollments (id,student_id,class_group_id,academic_year_id,enrollment_index,status,enrolled_at,created_at)
      select ${f.id('placement-')}||i,${f.id('pupil-')}||i,${f.id('cohort-')}||((i-1)/30+1),${f.id('year')},1,'active','2026-01-01',now() from generate_series(1,${size}) i`)
    await db.execute(sql`insert into class_subjects (id,class_group_id,subject_id,coefficient,is_offered,completed_percentage,created_at)
      select ${f.id('subject-')}||i,${f.id('cohort-')}||i,${f.id('math')},1,true,0,now() from generate_series(1,${Math.ceil(size / 30)}) i`)
    await db.execute(sql`insert into assessments (id,class_group_id,class_subject_id,period_id,title,kind,max_score,coefficient,starts_at,ends_at,marks_status,marks_review,created_at)
      select ${f.id('quiz-')}||i,${f.id('cohort-')}||i,${f.id('subject-')}||i,${f.id('period')},'Quiz','quiz',20,1,'2026-02-01','2026-02-01 01:00','approved',
        jsonb_build_object('rosterStudentIds',(select jsonb_agg(student_id) from student_class_enrollments where class_group_id=${f.id('cohort-')}||i),'editedBySubjectIds','[]'::jsonb,'history','[]'::jsonb),now() from generate_series(1,${Math.ceil(size / 30)}) i`)
    await db.execute(sql`insert into assessment_results (id,student_id,assessment_id,score,designation,created_at)
      select ${f.id('score-')}||i,${f.id('pupil-')}||i,${f.id('quiz-')}||((i-1)/30+1),12.75,'scored',now() from generate_series(1,${size}) i`)
    await db.execute(sql`insert into catalog_services (id,school_id,academic_year_id,name,category,enrollment_mode,billing_kind,default_price,currency,billing_terms,status,created_at)
      values (${f.id('catalog')},${f.id('school')},${f.id('year')},'Tuition','tuition','opt_in','one_time',10000,'XOF','{"kind":"one_time","installments":[]}'::jsonb,'active',now())`)
    await db.execute(sql`insert into student_service_enrollments (id,school_id,student_id,catalog_service_id,academic_year_id,status,source,accepted_terms,enrolled_at,created_at)
      select ${f.id('service-')}||i,${f.id('school')},${f.id('pupil-')}||i,${f.id('catalog')},${f.id('year')},'active','manual','{}'::jsonb,'2026-01-01',now() from generate_series(1,${size}) i`)
    await db.execute(sql`insert into student_charges (id,school_id,student_id,enrollment_id,academic_year_id,label,expected_amount,allocated_amount,adjustment_amount,waiver_amount,currency,due_date,status,installments,created_at)
      select ${f.id('charge-')}||i,${f.id('school')},${f.id('pupil-')}||i,${f.id('service-')}||i,${f.id('year')},'Tuition',10000,2500,0,0,'XOF','2026-01-15','partial',
        '[{"id":"first","label":"First","expectedAmount":5000,"dueDate":"2026-01-15T00:00:00.000Z"},{"id":"second","label":"Second","expectedAmount":5000,"dueDate":"2026-05-15T00:00:00.000Z"}]'::jsonb,now() from generate_series(1,${size}) i`)
    await db.execute(sql`analyze`)
    const scopes = await f.editor.baseService.access.overview.scopes()
    const repos = await f.editor.baseService.access.overview.repositories()
    const input = { schoolId: f.id('school'), academicYearId: f.id('year'), academicPeriodId: f.id('period'), referenceDate: new Date('2026-02-02') }
    let beforeQueries = 0
    let beforeRows = 0
    const measured = Object.fromEntries(Object.entries(repos).map(([key, repo]) => [key, new Proxy(repo, { get(target, method) {
      const value = Reflect.get(target, method)
      if (typeof value !== 'function')
        return value
      return async (...args: unknown[]) => {
        const result = await Reflect.apply(value, target, args)
        beforeQueries++
        beforeRows += Array.isArray(result) ? result.length : result ? 1 : 0
        return result
      }
    } })])) as typeof repos
    const start = performance.now()
    const before = await referenceOverview(measured, input)
    const beforeMs = performance.now() - start
    const queries: SQL[] = []
    let afterRows = 0
    const port = new PostgresDashboardProjections({ execute: async (query) => {
      queries.push(query)
      const result = await db.execute(query)
      afterRows += result.rows.length
      return result
    } })
    const afterStart = performance.now()
    const after = await port.overview(input, scopes)
    const afterMs = performance.now() - afterStart
    expect(after.kpis.studentCount).toBe(size + 1)
    expect(after.kpis.overdueFeeAmount).toBe(size * 2500)
    expect(after.kpis.overdueFeeAmount).toBe(before.kpis.overdueFeeAmount)
    expect(afterRows).toBeLessThan(beforeRows)
    const plans = []
    for (const query of queries) plans.push((await db.execute(sql`explain (analyze,buffers,format json) ${query}`)).rows)
    evidence.push({ students: size, classes: Math.ceil(size / 30), before: { queries: beforeQueries, rowsReturned: beforeRows, latencyMs: beforeMs }, after: { queries: queries.length, rowsReturned: afterRows, latencyMs: afterMs }, plans })
    mkdirSync(dirname(output!), { recursive: true })
    writeFileSync(output!, `${JSON.stringify({ engine: 'native PostgreSQL', capturedAt: new Date().toISOString(), method: 'One cold application call per dataset after ANALYZE; authorization scope construction excluded from both; original calculator retained under tests/support. EXPLAIN ANALYZE runs separately after timing.', measurements: evidence }, null, 2)}\n`)
  }, 30000)
}
