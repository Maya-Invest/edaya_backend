import type { SolveTimetableResult } from '../src/capabilities/timetable'
import { createHash } from 'node:crypto'
import { parseArgs } from 'node:util'
import { placementOccupiedIntervals, solveTimetable } from '../src/capabilities/timetable'
import { timetablePreviewFixture } from '../tests/support/timetable-preview-fixture'

const { values } = parseArgs({ args: Bun.argv.slice(2), options: { runs: { type: 'string', default: '5' }, resolver: { type: 'string' } } })
const solve: typeof solveTimetable = values.resolver ? (await import(values.resolver)).solveTimetable : solveTimetable
const runs = Number(values.runs)
if (!Number.isInteger(runs) || runs < 1)
  throw new Error('runs must be a positive integer')
const samples: number[] = []
let digest = ''
for (let run = 0; run <= runs; run++) {
  const occupied = [...timetablePreviewFixture.occupiedIntervals]
  const results: SolveTimetableResult[] = []
  const start = performance.now()
  for (const group of timetablePreviewFixture.classGroups) {
    const result = solve({ classGroupId: group.classGroupId, cells: timetablePreviewFixture.cells, subjects: group.subjects, occupiedIntervals: occupied, options: timetablePreviewFixture.options })
    results.push(result)
    occupied.push(...result.placements.flatMap(placement => placementOccupiedIntervals(group.classGroupId, placement)))
  }
  if (run > 0)
    samples.push(performance.now() - start)
  const currentDigest = createHash('sha256').update(JSON.stringify(results)).digest('hex')
  if (digest && currentDigest !== digest)
    throw new Error('Solver output changed between identical benchmark runs')
  digest = currentDigest
}
samples.sort((left, right) => left - right)
console.log(JSON.stringify({ classCount: 3, weeks: 13, runs, minMs: samples[0], medianMs: samples[Math.floor(samples.length / 2)], maxMs: samples.at(-1), digest }))
