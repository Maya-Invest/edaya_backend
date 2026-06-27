import { describe, expect, it } from 'bun:test'
import { countSeedStudents } from './dataset'
import { seedManifestEntitiesByStatus } from './seed-entity-manifest'
import {
  assertSeedManifestComplete,
  buildSeedValidationTargets,
  resolveSeedExpectedCounts,
} from './seed-validation-harness'

describe('seed validation harness', () => {
  it('has no missing entities in the manifest', () => {
    expect(seedManifestEntitiesByStatus('missing')).toHaveLength(0)
    expect(() => assertSeedManifestComplete()).not.toThrow()
  })

  it('maps manifest entities to expected fixture counts', () => {
    const counts = resolveSeedExpectedCounts()
    const targets = buildSeedValidationTargets()

    expect(targets.length).toBeGreaterThan(40)
    expect(counts.students).toBe(countSeedStudents())
    expect(targets.find(target => target.entity === 'students')?.minCount).toBe(countSeedStudents())
    expect(targets.find(target => target.entity === 'guardians')?.minCount).toBeGreaterThanOrEqual(900)
  })
})
