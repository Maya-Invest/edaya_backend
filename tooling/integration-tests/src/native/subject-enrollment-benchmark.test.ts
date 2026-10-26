import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { ClassSubject, Student, StudentClassEnrollment, Subject } from '@edaya/core'
import { expect, test } from 'bun:test'
import { reconcilePlacement } from '../../../../package/domain-service/src/capabilities/subject-enrollment/reconcile'
import { reconcilePlacementReference } from './support/compulsory-reference'
import { fixture } from './support/marks-fixture'

const output = process.env.EDAYA_IMPORT_BENCHMARK_OUTPUT
const evidence: unknown[] = []
interface Client { query: (...args: unknown[]) => Promise<{ rows: unknown[] }>, release: () => void }
// Keep a small query-count regression in the normal suite; opt into full benchmarks.
for (const size of output ? [100, 300, 1144] : [3]) {
  test(`compulsory persistence native before/after ${size} students`, async () => {
    const results = []
    for (const [mode, reconcile] of [['baseline', reconcilePlacementReference], ['candidate', reconcilePlacement]] as const) {
      const f = await fixture(`participation-${mode === 'baseline' ? 'base' : 'next'}-${size}`)
      for (let i = 1; i < 10; i++) {
        await f.r.subjects.save(new Subject({ id: f.id(`subject-${i}`), schoolId: f.id('school'), gradeLevelId: f.id('grade'), academicYearId: f.id('year'), name: `Subject ${i}` }))
        await f.r.classSubjects.save(new ClassSubject({ id: f.id(`offering-${i}`), classGroupId: f.id('class'), subjectId: f.id(`subject-${i}`) }))
      }
      await f.r.students.batchSave(Array.from({ length: size }, (_, i) => new Student({ id: f.id(`child-${i}`), schoolId: f.id('school'), firstName: 'Benchmark', lastName: String(i) })))
      const placements = Array.from({ length: size }, (_, i) => new StudentClassEnrollment({ id: f.id(`placement-${i}`), studentId: f.id(`child-${i}`), classGroupId: f.id('class'), academicYearId: f.id('year'), enrollmentIndex: 1, enrolledAt: new Date('2026-01-01') }))
      await f.r.enrollments.batchSave(placements)
      const pool = f.handles[0]!.sqlClient as unknown as { connect: () => Promise<Client> }
      const client = await pool.connect()
      const original = client.query.bind(client)
      let calls = 0
      let rows = 0
      let bytes = 0
      client.query = async (...args) => {
        const result = await original(...args)
        calls++
        rows += result.rows?.length ?? 0
        bytes += JSON.stringify(result.rows ?? []).length
        return result
      }
      client.release()
      const start = performance.now()
      try {
        for (const placement of placements)
          await f.application.atomicExecution.execute(() => reconcile(f.r, placement, undefined, f.editor.baseService.actor), { lockKeys: [`academic-state:${f.id('school')}`] })
      }
      finally { client.query = original }
      const elapsedMs = performance.now() - start
      expect(await f.r.subjectEnrollments.count({ studentClassEnrollmentId: { $in: placements.map(row => row.id) } })).toBe(size * 10)
      for (const offering of await f.r.classSubjects.list({ classGroupId: f.id('class') })) expect(offering.participationRevision).toBe(size)
      expect((await f.r.assessments.findById(f.id('assessment')))?.marksRevision).toBe(size)
      results.push({ mode, calls, materializedRows: rows, responseBytes: bytes, elapsedMs })
    }
    expect(results[1]!.calls).toBeLessThan(results[0]!.calls * 0.75)
    evidence.push({ students: size, compulsorySubjects: 10, results })
    if (output) {
      mkdirSync(dirname(output), { recursive: true })
      writeFileSync(output, JSON.stringify({ engine: 'disposable native PostgreSQL', method: 'Identical placement transactions, ten compulsory subjects and one draft assessment; current validation/invalidation shared by both; baseline retains previous individual persistence loop.', evidence }, null, 2))
    }
  }, 180000)
}
