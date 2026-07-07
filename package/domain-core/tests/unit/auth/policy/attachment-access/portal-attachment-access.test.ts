import { describe, expect, mock, test } from 'bun:test'
import { AuthorizationError } from '../../../../../src/capabilities/authorization'
import { portalAttachmentAccess } from '../../../../../src/capabilities/authorization/policy/strategies/attachment-access/portal'
import { AttachmentOwnerKind } from '../../../../../src/domain/school/attachment'
import { AuthFixtures } from '../../../../support/authorization-fixtures'
import { enrollmentRepos, paymentAttachmentRepos } from '../../../../support/policy-fixtures'

async function expectForbidden(operation: Promise<void>): Promise<void> {
  await expect(operation).rejects.toBeInstanceOf(AuthorizationError)
}

describe('portalAttachmentAccess', () => {
  test('allows guardian for student-owned attachment when student is linked', async () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1')
    await portalAttachmentAccess(actor, [{
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'student-1',
    }], enrollmentRepos('class-1'))
  })

  test('denies guardian for student-owned attachment when student is not linked', async () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1')
    await expectForbidden(portalAttachmentAccess(actor, [{
      ownerKind: AttachmentOwnerKind.Student,
      ownerId: 'student-2',
    }], enrollmentRepos('class-1')))
  })

  test('allows guardian for self-owned guardian attachment', async () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1')
    await portalAttachmentAccess(actor, [{
      ownerKind: AttachmentOwnerKind.Guardian,
      ownerId: 'guardian-1',
    }], enrollmentRepos('class-1'))
  })

  test('allows guardian for payment attachment when payment student fee is accessible', async () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1')
    const repos = paymentAttachmentRepos({
      id: 'payment-1',
      studentFeeId: 'student-fee-fee-1-student-1',
    })
    await portalAttachmentAccess(actor, [{
      ownerKind: AttachmentOwnerKind.Payment,
      ownerId: 'payment-1',
    }], repos)
  })

  test('forbids portal actors for staff-owned attachments', async () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1')
    await expectForbidden(portalAttachmentAccess(actor, [{
      ownerKind: AttachmentOwnerKind.Staff,
      ownerId: 'staff-1',
    }], enrollmentRepos('class-1')))
  })

  test('forbids portal actors for other-owned attachments', async () => {
    const actor = AuthFixtures.student.enrolledIn('class-1', 'student-1')
    await expectForbidden(portalAttachmentAccess(actor, [{
      ownerKind: AttachmentOwnerKind.Other,
      ownerId: 'misc-1',
    }], enrollmentRepos('class-1')))
  })

  test('allows guardian for enrollment attachment when student is linked', async () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1')
    const repos = {
      ...enrollmentRepos('class-1'),
      enrollments: {
        ...enrollmentRepos('class-1').enrollments,
        findById: mock(async () => ({
          id: 'enrollment-1',
          studentId: 'student-1',
          classGroupId: 'class-1',
        })),
      },
    }
    await portalAttachmentAccess(actor, [{
      ownerKind: AttachmentOwnerKind.StudentClassEnrollment,
      ownerId: 'enrollment-1',
    }], repos as never)
  })

  test('allows guardian for assessment result attachment linked to student', async () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1')
    const repos = {
      ...enrollmentRepos('class-1'),
      assessmentResults: {
        findById: mock(async () => ({
          id: 'result-1',
          studentId: 'student-1',
        })),
      },
    }
    await portalAttachmentAccess(actor, [{
      ownerKind: AttachmentOwnerKind.AssessmentResult,
      ownerId: 'result-1',
    }], repos as never)
  })

  test('allows guardian for report card attachment when student is linked', async () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1', 'class-1')
    const repos = {
      ...enrollmentRepos('class-1'),
      results: {
        findByIds: mock(async () => [{
          id: 'rcr-1',
          studentId: 'student-1',
          classGroupId: 'class-1',
        }]),
      },
    }
    await portalAttachmentAccess(actor, [{
      ownerKind: AttachmentOwnerKind.ReportCard,
      ownerId: 'rcr-1',
    }], repos as never)
  })

  test('allows guardian for attendance record attachment linked to class', async () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1', 'class-1')
    const repos = {
      ...enrollmentRepos('class-1'),
      attendance: {
        findById: mock(async () => ({
          id: 'attendance-1',
          studentId: 'student-1',
          classGroupId: 'class-1',
        })),
      },
      attendances: { findByIds: mock(async () => []), findById: mock(async () => undefined) },
      lessonSessions: {
        findByIds: mock(async () => []),
        findById: mock(async () => undefined),
      },
      classSubjects: { findByIds: mock(async () => []) },
      staffAssignments: { list: mock(async () => []) },
    }
    await portalAttachmentAccess(actor, [{
      ownerKind: AttachmentOwnerKind.AttendanceRecord,
      ownerId: 'attendance-1',
    }], repos as never)
  })

  test('allows guardian for disciplinary action attachment linked to student', async () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1')
    const repos = {
      ...enrollmentRepos('class-1'),
      studentDisciplinaryActions: {
        findById: mock(async () => ({
          id: 'action-1',
          studentId: 'student-1',
        })),
      },
    }
    await portalAttachmentAccess(actor, [{
      ownerKind: AttachmentOwnerKind.StudentDisciplinaryAction,
      ownerId: 'action-1',
    }], repos as never)
  })

  test('allows guardian for incident attachment in linked class group', async () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1', 'class-1')
    const repos = {
      ...enrollmentRepos('class-1'),
      incidents: {
        findById: mock(async () => ({
          id: 'incident-1',
          classGroupId: 'class-1',
        })),
      },
    }
    await portalAttachmentAccess(actor, [{
      ownerKind: AttachmentOwnerKind.Incident,
      ownerId: 'incident-1',
    }], repos as never)
  })

  test('denies guardian for incident without class group', async () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1', 'class-1')
    const repos = {
      ...enrollmentRepos('class-1'),
      incidents: {
        findById: mock(async () => ({ id: 'incident-1' })),
      },
    }
    await expectForbidden(portalAttachmentAccess(actor, [{
      ownerKind: AttachmentOwnerKind.Incident,
      ownerId: 'incident-1',
    }], repos as never))
  })

  test('denies guardian when payment attachment is missing', async () => {
    const actor = AuthFixtures.guardian.linkedTo('student-1')
    const repos = {
      ...enrollmentRepos('class-1'),
      payments: { findById: mock(async () => undefined) },
    }
    await expectForbidden(portalAttachmentAccess(actor, [{
      ownerKind: AttachmentOwnerKind.Payment,
      ownerId: 'missing-payment',
    }], repos as never))
  })
})
