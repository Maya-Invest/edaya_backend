import type { GradeLevelInput, SubjectInput } from '@edaya/core'
import { describe, expect, it } from 'bun:test'
import { demoCiSchedulingSlots } from '../../../src/datasets/demo-ci/domains/scheduling'
import { demoCiDataset } from '../../../src/datasets/demo-ci/index'
import { demoCiStaffMembers } from '../../../src/datasets/demo-ci/people'
import {
  demoCiClassGroups,
  demoCiClassSubjects,
  demoCiGradeLevels,
  demoCiSchool,
  demoCiSubjectMatters,
  demoCiSubjects,
} from '../../../src/datasets/demo-ci/school'

describe('demo-ci dataset (Côte d\'Ivoire)', () => {
  it('assembles a French Ivorian collège school shell', () => {
    expect(demoCiDataset.purpose).toBe('demo-ci')
    expect(demoCiDataset.entities.school?.country).toBe('Côte d\'Ivoire')
    expect(demoCiDataset.entities.school?.city).toBe('Abidjan')
    expect(demoCiDataset.entities.school?.timeZone).toBe('Africa/Abidjan')
    expect(demoCiGradeLevels).toHaveLength(4)
    expect(demoCiClassGroups).toHaveLength(3)
    expect(demoCiStaffMembers).toHaveLength(5)
    expect(demoCiDataset.entities.teachers).toHaveLength(2)
    expect(demoCiDataset.entities.teacherAssignments).toHaveLength(3)
    expect(demoCiSubjects).toHaveLength(8)
    expect(demoCiSubjectMatters.length).toBeGreaterThan(8)
    expect(demoCiSubjectMatters.some(matter => matter.name === 'Fractions et proportions')).toBe(true)
    expect(demoCiClassSubjects).toHaveLength(19)
    expect(demoCiDataset.entities.students).toHaveLength(12)
    expect(demoCiSchedulingSlots).toHaveLength(5)
    expect(demoCiDataset.extensions?.schedulingSlots).toHaveLength(5)
    expect(demoCiDataset.extensions?.schedulingSessionProgressAnchors).toHaveLength(3)
    expect(demoCiDataset.entities.gradeScales).toHaveLength(1)
    expect(demoCiDataset.extensions?.reportCardDefinitionFixtures).toHaveLength(2)
    expect(demoCiDataset.extensions?.reportCardResults).toHaveLength(12)
  })

  it('uses French subject and grade level labels', () => {
    const subject = demoCiSubjects[0] satisfies SubjectInput
    expect(subject.name).toBe('Français')

    const gradeLevel = demoCiGradeLevels[0] satisfies GradeLevelInput
    expect(gradeLevel.name).toBe('6ème')
    expect(gradeLevel.cycle).toBe('Collège')
  })

  it('names the school in French', () => {
    expect(demoCiSchool.name).toBe('École Edaya — Cocody')
  })
})
