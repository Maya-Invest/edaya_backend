import { describe, expect, it } from 'bun:test'
import { bulkDataset } from '../../../src/datasets/bulk'
import { demoDataset } from '../../../src/datasets/demo'

describe('bulkDataset', () => {
  it('has purpose bulk and merges demo with generated population', () => {
    expect(bulkDataset.purpose).toBe('bulk')
    expect(bulkDataset.entities.students?.length).toBeGreaterThan(demoDataset.entities.students?.length ?? 0)
    expect(bulkDataset.entities.guardians?.length).toBeGreaterThanOrEqual(demoDataset.entities.guardians?.length ?? 0)
    expect(bulkDataset.entities.classGroups?.length).toBeGreaterThan(demoDataset.entities.classGroups?.length ?? 0)
  })

  it('preserves demo domain slices on the composed dataset', () => {
    expect(bulkDataset.entities.activities?.length).toBe(demoDataset.entities.activities?.length)
    expect(bulkDataset.extensions?.reportCardResults?.length).toBe(
      demoDataset.extensions?.reportCardResults?.length,
    )
  })
})
