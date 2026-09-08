import { describe, expect, it } from 'bun:test'
import { demoDataset } from '../../../src/datasets/demo/index'
import { demoStaffMembers } from '../../../src/datasets/demo/people'
import {
  demoFoundationClassGroups,
  demoFoundationClassSubjects,
  demoFoundationSubjects,
} from '../../../src/datasets/demo/school'

describe('demo school shell', () => {
  it('assembles school shell, people, and curriculum entities', () => {
    expect(demoDataset.purpose).toBe('demo')
    expect(demoDataset.entities.school?.id).toBe('sch-edaya-central')
    expect(demoDataset.entities.gradeLevels).toHaveLength(12)
    expect(demoFoundationClassGroups).toHaveLength(3)
    expect(demoStaffMembers).toHaveLength(8)
    expect(demoFoundationSubjects).toHaveLength(6)
    expect(demoFoundationClassSubjects).toHaveLength(14)
  })
})
