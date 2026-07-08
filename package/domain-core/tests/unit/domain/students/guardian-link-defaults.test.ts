import { DomainValidationError, GuardianStudentLink } from '@edaya/core'
import { describe, expect, it } from 'bun:test'

describe('Guardian student link default values and validation', () => {
  const baseArgs = {
    id: 'link-1',
    schoolId: 'school-1',
    guardianId: 'guardian-1',
    studentId: 'student-1',
  }

  it('sets expected defaults when optional args are omitted', () => {
    const link = new GuardianStudentLink(baseArgs)

    expect(link.relationship).toBe('parent')
    expect(link.isPrimary).toBe(false)
    expect(link.isBillingContact).toBe(false)
    expect(link.legalGuardian).toBe(false)
    expect(link.canPickup).toBe(false)
    expect(link.receivesAcademicReports).toBe(true)
    expect(link.receivesAttendanceAlerts).toBe(true)
    expect(link.emergencyContactPriority).toBeUndefined()
    expect(link.contactRestrictions).toBeUndefined()
    expect(link.notes).toBeUndefined()
    expect(link.createdAt).toBeInstanceOf(Date)
  })

  it('respects explicitly provided values', () => {
    const link = new GuardianStudentLink({
      ...baseArgs,
      relationship: 'uncle',
      isPrimary: true,
      isBillingContact: true,
      legalGuardian: true,
      canPickup: true,
      receivesAcademicReports: false,
      receivesAttendanceAlerts: false,
      emergencyContactPriority: 2,
      contactRestrictions: 'No unsupervised contact',
      notes: 'Emergency contact preferred',
    })

    expect(link.relationship).toBe('uncle')
    expect(link.isPrimary).toBe(true)
    expect(link.isBillingContact).toBe(true)
    expect(link.legalGuardian).toBe(true)
    expect(link.canPickup).toBe(true)
    expect(link.receivesAcademicReports).toBe(false)
    expect(link.receivesAttendanceAlerts).toBe(false)
    expect(link.emergencyContactPriority).toBe(2)
    expect(link.contactRestrictions).toBe('No unsupervised contact')
    expect(link.notes).toBe('Emergency contact preferred')
  })

  it('throws DomainValidationError when emergencyContactPriority is negative', () => {
    expect(() => {
      new GuardianStudentLink({
        ...baseArgs,
        emergencyContactPriority: -1,
      })
    }).toThrow(DomainValidationError)
  })

  it('throws DomainValidationError when emergencyContactPriority is zero', () => {
    expect(() => {
      new GuardianStudentLink({
        ...baseArgs,
        emergencyContactPriority: 0,
      })
    }).toThrow(DomainValidationError)
  })

  it('throws DomainValidationError when blank strings are provided', () => {
    expect(() => {
      new GuardianStudentLink({
        ...baseArgs,
        relationship: '  ',
      })
    }).toThrow(DomainValidationError)
  })
})
