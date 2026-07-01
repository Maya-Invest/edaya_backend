import type { GuardianInput, GuardianStudentLinkInput, StudentInput } from '@edaya/core'
import { describe, expect, it } from 'bun:test'
import {
  demoClassStudentIds,
  demoEnrollments,
  demoGuardianLinks,
  demoGuardians,
  demoStudents,
} from '../../../src/datasets/demo/people'

describe('demo people', () => {
  it('typed students satisfy StudentInput', () => {
    const student = demoStudents[0] satisfies StudentInput
    expect(student?.id).toBe('s1')
  })

  it('typed guardians satisfy GuardianInput', () => {
    const guardian = demoGuardians[0] satisfies GuardianInput
    expect(guardian.id).toBe('g1')
  })

  it('typed links satisfy GuardianStudentLinkInput', () => {
    const link = demoGuardianLinks[0] satisfies GuardianStudentLinkInput
    expect(link.guardianId).toBe('g1')
  })

  it('enrollments reference known students and classes', () => {
    expect(demoEnrollments).toHaveLength(demoStudents.length)
    expect(demoClassStudentIds['6a']).toContain('s1')
  })
})
