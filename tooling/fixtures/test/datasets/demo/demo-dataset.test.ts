import { describe, expect, it } from 'bun:test'
import { demoDataset } from '../../../src/datasets/demo'

describe('demoDataset', () => {
  it('assembles foundation entities and domain extensions', () => {
    expect(demoDataset.purpose).toBe('demo')
    expect(demoDataset.entities.school?.id).toBe('sch-edaya-central')
    expect(demoDataset.entities.students).toHaveLength(30)
    expect(demoDataset.entities.classGroups).toHaveLength(8)
    expect(demoDataset.entities.classSubjects?.length).toBe(28)
    expect(demoDataset.entities.activities?.length).toBeGreaterThan(0)
    expect(demoDataset.entities.inClassAssessments?.length).toBeGreaterThan(0)
    expect(demoDataset.extensions?.attendanceSessions?.todaySession.records.length).toBe(6)
    expect(demoDataset.extensions?.reportCardResults?.length).toBeGreaterThan(0)
  })
})
