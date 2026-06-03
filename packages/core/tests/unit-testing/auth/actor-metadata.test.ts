import { describe, expect, it } from 'bun:test'
import {
  ActorAssuranceLevel,
  AuthorizationError,
  AuthorizationErrorCode,
  createGuardianActorMetadata,
  createStaffActorMetadata,
  createStudentActorMetadata,
  createSystemActorMetadata,
  isInteractiveActor,
  resolveAuditActorId,
} from '../../../src/authorization'
import { StaffRole } from '../../../src/entities'

describe('actor metadata', () => {
  it('creates immutable staff context with normalized roles and audit identity', () => {
    const actor = createStaffActorMetadata({
      subjectId: 'user-1',
      staffMemberId: 'teacher-1',
      schoolId: 'school',
      roles: [StaffRole.Teacher, StaffRole.Teacher],
      requestId: 'request-1',
      sessionId: 'session-1',
      authenticatedAt: new Date('2026-09-01T08:00:00Z'),
      assuranceLevel: ActorAssuranceLevel.Verified,
    })

    expect(actor.roles).toEqual([StaffRole.Teacher])
    expect(actor.assuranceLevel).toBe(ActorAssuranceLevel.Verified)
    expect(resolveAuditActorId(actor)).toBe('teacher-1')
    expect(Object.isFrozen(actor)).toBe(true)
    expect(Object.isFrozen(actor.roles)).toBe(true)
  })

  it('separates self-service actors and system execution from authenticated account identity', () => {
    const guardian = createGuardianActorMetadata({
      subjectId: 'user-guardian',
      guardianId: 'guardian',
      schoolId: 'school',
      requestId: 'request-guardian',
      authenticatedAt: new Date('2026-09-01T08:00:00Z'),
    })
    const student = createStudentActorMetadata({
      subjectId: 'user-student',
      studentId: 'student',
      schoolId: 'school',
      requestId: 'request-student',
      authenticatedAt: new Date('2026-09-01T08:00:00Z'),
    })
    const system = createSystemActorMetadata({
      systemId: 'nightly-fee-job',
      schoolId: 'school',
      requestId: 'job-run',
      reason: 'Apply overdue status changes',
    })

    expect(resolveAuditActorId(guardian)).toBe('guardian')
    expect(resolveAuditActorId(student)).toBe('student')
    expect(resolveAuditActorId(system)).toBe('nightly-fee-job')
    expect(isInteractiveActor(guardian)).toBe(true)
    expect(isInteractiveActor(system)).toBe(false)
    expect(guardian.assuranceLevel).toBe(ActorAssuranceLevel.Standard)
  })

  it('rejects incomplete trusted metadata and exposes stable authorization errors', () => {
    expect(() => createStaffActorMetadata({
      subjectId: 'user-1',
      staffMemberId: 'teacher-1',
      schoolId: 'school',
      roles: [],
      requestId: 'request-1',
      authenticatedAt: new Date('2026-09-01T08:00:00Z'),
    })).toThrow('roles must contain at least one role')

    const error = new AuthorizationError(AuthorizationErrorCode.Forbidden)
    expect(error.name).toBe('AuthorizationError')
    expect(error.code).toBe(AuthorizationErrorCode.Forbidden)
    expect(error.message).toBe('Operation is not permitted')
  })
})
