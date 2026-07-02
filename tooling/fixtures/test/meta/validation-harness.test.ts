import { describe, expect, it } from 'bun:test'
import { demoDataset } from '../../src/datasets/demo'
import { seedManifestEntitiesByStatus } from '../../src/meta/entity-manifest'
import { countStudents } from '../../src/meta/fixture-counts'
import {
  assertSeedManifestComplete,
  buildSeedValidationTargets,
  resolveExpectedCounts,
} from '../../src/meta/validation-harness'

describe('seed validation harness', () => {
  it('has no missing entities in the manifest', () => {
    expect(seedManifestEntitiesByStatus('missing')).toHaveLength(0)
    expect(() => assertSeedManifestComplete()).not.toThrow()
  })

  it('maps manifest entities to expected fixture counts', () => {
    const counts = resolveExpectedCounts(demoDataset)
    const targets = buildSeedValidationTargets()

    expect(targets.length).toBeGreaterThan(40)
    expect(counts.students).toBe(countStudents(demoDataset))
    expect(targets.find(target => target.entity === 'students')?.minCount).toBe(countStudents(demoDataset))
    expect(targets.find(target => target.entity === 'guardians')?.minCount).toBeGreaterThanOrEqual(20)
  })
})
