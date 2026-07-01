import { describe, expect, it } from 'bun:test'
import {
  EnrollmentEndReason,
  ProgressionDecision,
  StudentClassEnrollment,
  StudentClassEnrollmentStatus,
} from '../../../../src/domain/students/student-class-enrollment'

describe('Student class enrollment state transitions and validation', () => {
  const baseArgs = {
    id: 'enrollment-1',
    studentId: 'student-1',
    classGroupId: 'class-1',
    academicYearId: 'year-1',
    enrollmentIndex: 1,
    status: StudentClassEnrollmentStatus.Active,
    enrolledAt: new Date('2026-09-01T08:00:00Z'),
  }

  it('instantiates active enrollment successfully', () => {
    const enrollment = new StudentClassEnrollment(baseArgs)
    expect(enrollment.status).toBe(StudentClassEnrollmentStatus.Active)
    expect(enrollment.endedAt).toBeUndefined()
    expect(enrollment.endReason).toBeUndefined()
  })

  it('throws when active enrollment has closure details', () => {
    expect(() => {
      new StudentClassEnrollment({
        ...baseArgs,
        endedAt: new Date('2026-09-10T08:00:00Z'),
      })
    }).toThrow('active enrollments must not define closure information')
  })

  it('throws when closed enrollment lacks closure details', () => {
    expect(() => {
      new StudentClassEnrollment({
        ...baseArgs,
        status: StudentClassEnrollmentStatus.Closed,
      })
    }).toThrow('closed enrollments must define endedAt, endReason, and closedBy')
  })

  it('throws when endedAt is before enrolledAt', () => {
    expect(() => {
      new StudentClassEnrollment({
        ...baseArgs,
        status: StudentClassEnrollmentStatus.Closed,
        enrolledAt: new Date('2026-09-05T08:00:00Z'),
        endedAt: new Date('2026-09-01T08:00:00Z'),
        endReason: EnrollmentEndReason.Completed,
        closedBy: 'admin-1',
      })
    }).toThrow('endedAt must not be before enrolledAt')
  })

  it('correctly closes an active enrollment', () => {
    const active = new StudentClassEnrollment(baseArgs)
    const closedDate = new Date('2027-06-30T12:00:00Z')
    const closed = active.close({
      endedAt: closedDate,
      endReason: EnrollmentEndReason.Completed,
      closedBy: 'admin-1',
    })

    expect(closed.status).toBe(StudentClassEnrollmentStatus.Closed)
    expect(closed.endedAt).toEqual(closedDate)
    expect(closed.endReason).toBe(EnrollmentEndReason.Completed)
    expect(closed.closedBy).toBe('admin-1')
  })

  it('throws when attempting to close an already closed enrollment', () => {
    const active = new StudentClassEnrollment(baseArgs)
    const closed = active.close({
      endedAt: new Date('2027-06-30T12:00:00Z'),
      endReason: EnrollmentEndReason.Completed,
      closedBy: 'admin-1',
    })

    expect(() => {
      closed.close({
        endedAt: new Date('2027-07-01T12:00:00Z'),
        endReason: EnrollmentEndReason.Completed,
        closedBy: 'admin-1',
      })
    }).toThrow('is already closed')
  })

  it('throws when progression decision is recorded without metadata', () => {
    expect(() => {
      new StudentClassEnrollment({
        ...baseArgs,
        status: StudentClassEnrollmentStatus.Closed,
        endedAt: new Date('2026-09-10T08:00:00Z'),
        endReason: EnrollmentEndReason.Completed,
        closedBy: 'admin-1',
        progressionDecision: ProgressionDecision.Promoted,
      })
    }).toThrow('progressionDecidedAt and progressionDecidedBy are required when a progression decision is recorded')
  })

  it('throws when progression metadata is provided without a decision', () => {
    expect(() => {
      new StudentClassEnrollment({
        ...baseArgs,
        status: StudentClassEnrollmentStatus.Closed,
        endedAt: new Date('2026-09-10T08:00:00Z'),
        endReason: EnrollmentEndReason.Completed,
        closedBy: 'admin-1',
        progressionDecidedBy: 'admin-1',
      })
    }).toThrow('progression metadata requires a progression decision')
  })

  it('throws when progression decision is recorded for non-completed reason', () => {
    expect(() => {
      new StudentClassEnrollment({
        ...baseArgs,
        status: StudentClassEnrollmentStatus.Closed,
        endedAt: new Date('2026-09-10T08:00:00Z'),
        endReason: EnrollmentEndReason.Transferred,
        closedBy: 'admin-1',
        progressionDecision: ProgressionDecision.Promoted,
        progressionDecidedAt: new Date('2026-09-10T08:00:00Z'),
        progressionDecidedBy: 'admin-1',
      })
    }).toThrow('a progression decision requires a completed enrollment')
  })

  it('successfully records a progression decision on a completed enrollment', () => {
    const enrollment = new StudentClassEnrollment({
      ...baseArgs,
      status: StudentClassEnrollmentStatus.Closed,
      endedAt: new Date('2026-09-10T08:00:00Z'),
      endReason: EnrollmentEndReason.Completed,
      closedBy: 'admin-1',
    })

    const decidedAt = new Date('2026-09-11T08:00:00Z')
    const updated = enrollment.recordProgressionDecision({
      decision: ProgressionDecision.Promoted,
      decidedAt,
      decidedBy: 'admin-1',
      notes: 'Excellent performance',
    })

    expect(updated.progressionDecision).toBe(ProgressionDecision.Promoted)
    expect(updated.progressionDecidedAt).toEqual(decidedAt)
    expect(updated.progressionDecidedBy).toBe('admin-1')
    expect(updated.progressionNotes).toBe('Excellent performance')
  })

  it('throws when recording a progression decision when one already exists', () => {
    const enrollment = new StudentClassEnrollment({
      ...baseArgs,
      status: StudentClassEnrollmentStatus.Closed,
      endedAt: new Date('2026-09-10T08:00:00Z'),
      endReason: EnrollmentEndReason.Completed,
      closedBy: 'admin-1',
      progressionDecision: ProgressionDecision.Promoted,
      progressionDecidedAt: new Date('2026-09-10T08:00:00Z'),
      progressionDecidedBy: 'admin-1',
    })

    expect(() => {
      enrollment.recordProgressionDecision({
        decision: ProgressionDecision.Retained,
        decidedAt: new Date('2026-09-11T08:00:00Z'),
        decidedBy: 'admin-1',
      })
    }).toThrow('already has a progression decision')
  })
})
