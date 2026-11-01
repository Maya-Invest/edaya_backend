import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { expect, test } from 'bun:test'
import { measureCompulsoryPersistence } from '../native/support/subject-enrollment-measurement'

const output = process.env.EDAYA_IMPORT_BENCHMARK_OUTPUT
if (!output)
  throw new Error('Run benchmarks through test:benchmarks')
const evidence: unknown[] = []
for (const size of [100, 300, 1144]) {
  test(`compulsory persistence native before/after ${size} students`, async () => {
    const results = await measureCompulsoryPersistence(size)
    expect(results[1]!.calls).toBeLessThan(results[0]!.calls * 0.75)
    evidence.push({ students: size, compulsorySubjects: 10, results })
    mkdirSync(dirname(output!), { recursive: true })
    writeFileSync(output!, JSON.stringify({ engine: 'disposable native PostgreSQL', method: 'Identical placement transactions, ten compulsory subjects and one draft assessment; current validation/invalidation shared by both; baseline retains previous individual persistence loop.', evidence }, null, 2))
  }, 180000)
}
