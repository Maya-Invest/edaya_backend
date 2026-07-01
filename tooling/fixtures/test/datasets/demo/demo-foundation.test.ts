import type { GradeLevelInput, SubjectInput } from '@edaya/core'
import { describe, expect, it } from 'bun:test'
import { demoDataset } from '../../../src/datasets/demo/index'
import { demoStaffMembers } from '../../../src/datasets/demo/people'
import {
  demoFoundationClassGroups,
  demoFoundationClassSubjects,
  demoFoundationSubjects,
  demoGradeLevels,
} from '../../../src/datasets/demo/school'

describe('demo school shell', () => {
  it('assembles school shell, people, and curriculum entities', () => {
    expect(demoDataset.purpose).toBe('demo')
    expect(demoDataset.entities.school?.id).toBe('sch-edaya-central')
    expect(demoDataset.entities.gradeLevels).toHaveLength(7)
    expect(demoFoundationClassGroups).toHaveLength(3)
    expect(demoStaffMembers).toHaveLength(8)
    expect(demoFoundationSubjects).toHaveLength(6)
    expect(demoFoundationClassSubjects).toHaveLength(14)
  })

  it('typed subjects satisfy SubjectInput', () => {
    const subject = demoFoundationSubjects[0] satisfies SubjectInput
    expect(subject.code).toBe('MATH')
  })

  it('typed grade levels satisfy GradeLevelInput', () => {
    const gradeLevel = demoGradeLevels[0] satisfies GradeLevelInput
    expect(gradeLevel.name).toBe('6ème')
  })
})
