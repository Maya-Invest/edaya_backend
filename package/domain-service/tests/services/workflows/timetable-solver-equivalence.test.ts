import { createHash } from 'node:crypto'
import { TimetableGenerationMode } from '@edaya/core'
import { expect, test } from 'bun:test'
import { solveTimetable, spreadWeeklyTemplate } from '../../../src/capabilities/timetable'
import { timetableEquivalenceCase } from '../../support/timetable-equivalence-fixture'
import baseline from '../../support/timetable-solver-baseline.json'

// Free-mode fingerprints retain the original solver baseline. Weekly fingerprints
// include repair around occupied records and calendar closures.
for (const mode of [TimetableGenerationMode.Weekly, TimetableGenerationMode.Free]) {
  for (let seed = 0; seed < 12; seed++) {
    test(`preserves deterministic ${mode} placements and diagnostics, fixture ${seed}`, () => {
      const { input, spread } = timetableEquivalenceCase(seed, mode)
      const original = JSON.stringify(input)
      const solved = solveTimetable(input)
      const result = mode === TimetableGenerationMode.Weekly ? { solved, spread: spreadWeeklyTemplate(spread(solved.placements)) } : solved
      const digest = createHash('sha256').update(JSON.stringify(result)).digest('hex')
      expect(digest).toBe(baseline[`${mode}-${seed}` as keyof typeof baseline])
      expect(JSON.stringify(input)).toBe(original)
    })
  }
}
