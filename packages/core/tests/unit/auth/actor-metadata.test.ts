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
import { effectiveGrantsForRoles, portalEffectiveGrantsForGuardian, portalEffectiveGrantsForStudent } from '../../support/effective-grants'

describe('actor metadata', () => {
  it('creates immutable grant-backed staff context with audit identity', () => {
    const actor = createStaffActorMetadata({
      subjectId: 'user-1',
      staffMemberId: 'teacher-1',
      schoolId: 'school',
      effectiveGrants: effectiveGrantsForRoles([]),
      requestId: 'request-1',
      sessionId: 'session-1',
      authenticatedAt: new Date('2026-09-01T08:00:00Z'),
      assuranceLevel: ActorAssuranceLevel.Verified,
    })

    expect(actor.assuranceLevel).toBe(ActorAssuranceLevel.Verified)
    expect(resolveAuditActorId(actor)).toBe('teacher-1')
    expect(Object.isFrozen(actor)).toBe(true)
    expect(actor.effectiveGrants).toBeDefined()
  })

  it('allows grant-backed staff context without legacy roles', () => {
    const actor = createStaffActorMetadata({
      subjectId: 'user-1',
      staffMemberId: 'teacher-1',
      schoolId: 'school',
      requestId: 'request-1',
      authenticatedAt: new Date('2026-09-01T08:00:00Z'),
      effectiveGrants: {
        permissions: new Set(),
        scopeGrants: [],
        isElevated: false,
      },
    })

    expect(actor.effectiveGrants).toBeDefined()
    expect(resolveAuditActorId(actor)).toBe('teacher-1')
  })

  it('separates self-service actors and system execution from authenticated account identity', () => {
    const guardian = createGuardianActorMetadata({
      subjectId: 'user-guardian',
      guardianId: 'guardian',
      schoolId: 'school',
      requestId: 'request-guardian',
      authenticatedAt: new Date('2026-09-01T08:00:00Z'),
      effectiveGrants: portalEffectiveGrantsForGuardian(['student']),
    })
    const student = createStudentActorMetadata({
      subjectId: 'user-student',
      studentId: 'student',
      schoolId: 'school',
      requestId: 'request-student',
      authenticatedAt: new Date('2026-09-01T08:00:00Z'),
      effectiveGrants: portalEffectiveGrantsForStudent('student'),
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
      staffMemberId: '',
      schoolId: 'school',
      effectiveGrants: effectiveGrantsForRoles([]),
      requestId: 'request-1',
      authenticatedAt: new Date('2026-09-01T08:00:00Z'),
    })).toThrow()

    const error = new AuthorizationError(AuthorizationErrorCode.Forbidden)
    expect(error.name).toBe('AuthorizationError')
    expect(error.code).toBe(AuthorizationErrorCode.Forbidden)
    expect(error.message).toBe('Operation is not permitted')
  })
})
