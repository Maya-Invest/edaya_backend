import type { StudentInput } from '@edaya/core'
import { describe, expect, it } from 'bun:test'
import { integrationStudents } from '../../src/datasets/integration/people'
import { minimalDataset } from '../../src/datasets/minimal'

describe('FixtureDataset types', () => {
  it('accepts domain StudentInput shape via satisfies', () => {
    const sampleStudent = {
      id: 's1',
      schoolId: 'sch-edaya-central',
      firstName: 'Amélie',
      lastName: 'Laurent',
      birthDate: '2014-03-12',
    } satisfies StudentInput

    expect(sampleStudent.id).toBe('s1')
  })

  it('exposes minimal dataset with typed school and people', () => {
    expect(minimalDataset.purpose).toBe('minimal')
    expect(minimalDataset.entities.school?.id).toBe('sch-edaya-central')
    expect(minimalDataset.entities.staffMembers?.[0]?.id).toBe('st8')
    expect(minimalDataset.entities.guardians?.[0]?.id).toBe('g1')
  })

  it('integration students compile as StudentInput', () => {
    expect(integrationStudents).toHaveLength(6)
    expect(integrationStudents[0]?.firstName).toBe('Amélie')
  })
})
