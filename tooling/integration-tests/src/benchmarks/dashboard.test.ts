import type { SQL } from 'drizzle-orm'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { PostgresDashboardProjections } from '@edaya/adaptor-postgres'
import { expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { buildSchoolOverview as referenceOverview } from '../../../../package/domain-service/tests/support/overview-reference'
import { fixture } from '../native/support/marks-fixture'

import { seedDirectoryCohorts } from './support/directory-cohorts'

const output = process.env.EDAYA_BENCHMARK_OUTPUT
const evidence: unknown[] = []
if (!output)
  throw new Error('Run benchmarks through test:benchmarks')
for (const size of [30, 300, 3000]) {
  test(`dashboard projection benchmark ${size} students`, async () => {
    const f = await fixture(`benchmark-${size}`)
    const db = f.handles[0]!.db as { execute: (query: SQL) => Promise<{ rows: Record<string, unknown>[] }> }
    // Thirty students per class, one submitted sheet and one partially settled charge per student.
    await seedDirectoryCohorts(db, f.id, size)
    await db.execute(sql`insert into catalog_services (id,school_id,academic_year_id,name,short_name,category,auto_billing,billing_kind,default_price,currency,billing_terms,status,created_at)
      values (${f.id('catalog')},${f.id('school')},${f.id('year')},'Tuition','Tuition','tuition','{"mode":"off"}'::jsonb,'one_time',10000,'XOF','{"kind":"one_time","installments":[]}'::jsonb,'active',now())`)
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
