import type { SolveTimetableInput, SpreadWeeklyTemplateInput } from '../src/capabilities/timetable'
import type { SchoolRepositories } from '../src/ports/school-repositories'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { parseArgs } from 'node:util'
import { TimetableGenerationMode } from '@edaya/core'
import { BaseSchoolService } from '../src/services/base-school-service'
import { TimetableGenerationServiceWorkflow } from '../src/services/workflows/timetable-generation'
import { closeServiceTestDatabases, resetServiceTestDatabases } from '../tests/support/database-pool'
import { createTimetableBenchmarkFixture } from '../tests/support/timetable-benchmark-fixture'

// Local SQL fixture timing: database setup is excluded; no HTTP/network is simulated.
const { values } = parseArgs({ args: Bun.argv.slice(2), options: { classes: { type: 'string', default: '3,10,30' }, weeks: { type: 'string', default: '1,13,40' }, modes: { type: 'string', default: 'weekly,free' }, runs: { type: 'string', default: '3' }, workflow: { type: 'string' } } })
const Workflow: typeof TimetableGenerationServiceWorkflow = values.workflow
  ? (await import(values.workflow)).TimetableGenerationServiceWorkflow
  : TimetableGenerationServiceWorkflow
const runs = Number(values.runs)
function sizes(value: string): number[] {
  const numbers = value.split(',').map(Number)
  if (numbers.some(number => !Number.isInteger(number) || number < 1))
    throw new Error('Benchmark sizes must be positive integers')
  return numbers
}
if (!Number.isInteger(runs) || runs < 1)
  throw new Error('runs must be a positive integer')
const modes = values.modes!.split(',')
if (!modes.length || modes.some(mode => mode !== TimetableGenerationMode.Weekly && mode !== TimetableGenerationMode.Free))
  throw new Error('modes must contain weekly and/or free')

for (const classCount of sizes(values.classes!)) {
  for (const weeks of sizes(values.weeks!)) {
    for (const mode of modes as TimetableGenerationMode[]) {
      const fixture = await createTimetableBenchmarkFixture(classCount, weeks)
      const phases = { readMs: 0, solveMs: 0, spreadMs: 0, persistMs: 0 }
      const queryCounts: Record<string, number> = {}
      const wrap = (repository: object, resource: string): object => new Proxy(repository, {
        get(target, property) {
          const method = Reflect.get(target, property)
          if (typeof method !== 'function')
            return method
          if (property === 'forAccess' || property === 'forSchool')
            return (...args: unknown[]) => wrap(Reflect.apply(method, target, args), resource)
          return async (...args: unknown[]) => {
            const name = `${resource}.${String(property)}`
            queryCounts[name] = (queryCounts[name] ?? 0) + 1
            const start = performance.now()
            try {
              return await Reflect.apply(method, target, args)
            }
            finally {
              const duration = performance.now() - start
              if (['save', 'batchSave', 'delete', 'batchDelete'].includes(String(property)))
                phases.persistMs += duration
              else
                phases.readMs += duration
            }
          }
        },
      })
      const repositories = new Proxy(fixture.schoolRepositories, {
        get(target, property) { return wrap(Reflect.get(target, property), String(property)) },
      }) as SchoolRepositories
      const original = fixture.app.timetableGenerationWorkflow.baseService
      const base = new BaseSchoolService({ ...original, repositories })
      class TimedWorkflow extends Workflow {
        protected override solve(input: SolveTimetableInput) {
          const start = performance.now()
          try {
            return super.solve(input)
          }
          finally { phases.solveMs += performance.now() - start }
        }

        protected override spread(input: SpreadWeeklyTemplateInput) {
          const start = performance.now()
          try {
            return super.spread(input)
          }
          finally { phases.spreadMs += performance.now() - start }
        }
      }
      const workflow = new TimedWorkflow(base)
      const samples = []
      for (let run = 0; run <= runs; run++) {
        // Restore the same initial state; later classes still see this run's writes.
        const generated = await fixture.schoolRepositories.lessonSessions.list({ timetableGenerated: true })
        await fixture.schoolRepositories.lessonSessions.batchDelete(generated.map(row => row.id))
        Object.assign(phases, { readMs: 0, solveMs: 0, spreadMs: 0, persistMs: 0 })
        for (const key of Object.keys(queryCounts)) delete queryCounts[key]
        const start = performance.now()
        const results = []
        for (const group of fixture.groups) {
          results.push(await workflow.generateClassGroupTimetable({ ...fixture.input, classGroupId: group.id, options: { ...fixture.input.options, generationMode: mode } }))
        }
        const generationMs = performance.now() - start
        const response = JSON.stringify(results)
        const totalMs = performance.now() - start
        const digest = createHash('sha256').update(JSON.stringify(results.map(({ classGroupId, placements, unmetWorkloads }) => ({ classGroupId, placements, unmetWorkloads })))).digest('hex')
        if (run > 0)
          samples.push({ totalMs, generationMs, ...phases, responseBytes: Buffer.byteLength(response), digest, queryCounts: { ...queryCounts } })
      }
      samples.sort((left, right) => left.totalMs - right.totalMs)
      console.log(JSON.stringify({ classCount, weeks, mode, runs, ...samples[Math.floor(samples.length / 2)] }))
      await resetServiceTestDatabases()
    }
  }
}
await closeServiceTestDatabases()
