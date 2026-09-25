import type { StudentInput } from '@edaya/core'
import { describe, expect, it } from 'bun:test'
import { bootstrapSeedDataset } from '../../src/meta/seed-slice'

describe('FixtureDataset types', () => {
  it('accepts domain StudentInput shape via satisfies', () => {
    const sampleStudent = {
      id: 'ci-s1',
      schoolId: 'sch-edaya-ci-cocody',
      firstName: 'Aminata',
      lastName: 'Koné',
      birthDate: '2014-02-14',
    } satisfies StudentInput

    expect(sampleStudent.id).toBe('ci-s1')
  })

  it('exposes a bootstrap slice with the owner and one guardian', () => {
    const dataset = bootstrapSeedDataset()
    expect(dataset.purpose).toBe('demo-ci')
    expect(dataset.entities.school?.id).toBe('sch-edaya-ci-cocody')
    expect(dataset.entities.staffMembers?.map(member => member.id)).toEqual(['ci-st8'])
    expect(dataset.entities.guardians?.map(guardian => guardian.id)).toEqual(['ci-g1'])
    expect(dataset.entities.students).toBeUndefined()
  })
})
