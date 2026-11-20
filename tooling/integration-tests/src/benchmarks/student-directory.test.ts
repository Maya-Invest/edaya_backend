import type { StudentDirectoryInput } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { fixture } from '../native/support/marks-fixture'
import { seedDirectoryCohorts } from './support/directory-cohorts'

const samples: unknown[] = []
const output = process.env.EDAYA_BENCHMARK_OUTPUT
if (!output)
  throw new Error('Run through the disposable native benchmark runner')

for (const size of [30, 300, 3000]) {
  test(`student directory native reads with ${size} students`, async () => {
    const f = await fixture(`directory-${size}`)
    const db = f.handles[0]!.db as { execute: (query: SQL) => Promise<unknown> }
    await seedDirectoryCohorts(db, f.id, size)
    await db.execute(sql`analyze`)
    const workloads: Record<string, StudentDirectoryInput> = {
      first: {},
      later: { offset: size - 25 },
      search: { q: 'Student 20' },
      average: { sort: 'average', sortDir: 'desc' },
      attendance: { sort: 'attendance' },
      class: { sort: 'class' },
    }
    for (const [workload, input] of Object.entries(workloads)) {
      const run = (etag?: string) => f.editor.revalidateStudentDirectory(input, etag)
      const start = performance.now()
      const first = await run()
      const firstMs = performance.now() - start
      const page = first.page!
      expect(page.total).toBe(workload === 'search' ? Array.from({ length: size }, (_, i) => String(i + 1)).filter(n => n.startsWith('20')).length : size + 1)
      expect(page.rows.length).toBeLessThanOrEqual(25)
      const freshMs = []
      const revalidateMs = []
      for (let i = 0; i < 3; i++) {
        for (const conditional of [i % 2 === 0, i % 2 !== 0]) {
          const start = performance.now()
          const result = await run(conditional ? first.etag : undefined)
          const elapsed = performance.now() - start
          expect(result.etag).toBe(first.etag)
          if (conditional) {
            expect(result.page).toBeUndefined()
            revalidateMs.push(elapsed)
          }
          else {
            expect(result.page).toEqual(page)
            freshMs.push(elapsed)
          }
        }
      }
      samples.push({ size, workload, rows: page.rows.length, total: page.total, firstMs, freshMs, revalidateMs })
      mkdirSync(dirname(output!), { recursive: true })
      writeFileSync(join(dirname(output!), 'student-directory-benchmark.json'), `${JSON.stringify({
        method: 'Native PostgreSQL, owner, real permission and revision work inside read-only snapshot; first read and three alternating authorized fresh and conditional reads. HTTP and rendering excluded. One extra pupil in the marks fixture.',
        samples,
      }, null, 2)}\n`)
    }
  }, 180000)
}

test('student directory validator reuse during write traffic', async () => {
  const f = await fixture('directory-traffic')
  const otherSchool = await fixture('directory-unrelated')
  const db = f.handles[1]!.db as { execute: (query: SQL) => Promise<unknown> }
  await seedDirectoryCohorts(db, f.id, 300)
  await db.execute(sql`analyze`)
  const results = []
  for (const workload of ['idle', 'other school pupil', 'same school pupil', 'same school staff label'] as const) {
    const firstPage = await f.editor.revalidateStudentDirectory({})
    if (!firstPage.page)
      throw new Error('First read must return a directory page')
    let etag = firstPage.etag
    let validated = 0
    const freshMs = []
    const validatedMs = []
    const writeMs = []
    for (let i = 0; i < 10; i++) {
      const startWrite = performance.now()
      if (workload === 'other school pupil' || workload === 'same school pupil') {
        const id = workload === 'other school pupil' ? otherSchool.id('student') : f.id('pupil-290')
        await db.execute(sql`update students set first_name=${`Edited${i}`} where id=${id}`)
      }
      if (workload === 'same school staff label')
        await db.execute(sql`update staff_members set first_name=${`Reviewer${i}`} where id=${f.id('reviewer')}`)
      if (workload !== 'idle')
        writeMs.push(performance.now() - startWrite)
      const startRead = performance.now()
      const next = await f.editor.revalidateStudentDirectory({}, etag)
      const elapsed = performance.now() - startRead
      if (next.page) {
        if (workload === 'same school staff label')
          expect(next.page).toEqual(firstPage.page)
        freshMs.push(elapsed)
      }
      else {
        validated++
        validatedMs.push(elapsed)
      }
      etag = next.etag
    }
    if (workload === 'idle' || workload === 'other school pupil')
      expect(validated).toBe(10)
    if (workload === 'same school pupil')
      expect(validated).toBe(0)
    results.push({ workload, requests: 10, validated, freshMs, validatedMs, writeMs })
  }
  mkdirSync(dirname(output!), { recursive: true })
  writeFileSync(join(dirname(output!), 'directory-write-traffic.json'), `${JSON.stringify({
    method: 'Native PostgreSQL, 300 additional students, owner reading first page. Ten sequential edit/revisit pairs on separate database connections per workload. This measures invalidation breadth and service latency. Writer throughput under concurrency is a separate test.',
    results,
  }, null, 2)}\n`)
}, 30000)
