import { describe, expect, test } from 'bun:test'
import { operationModule } from '../../../src/application/entities/entity-config'
import {
  ALL_GUARDIAN_CAPABILITIES,
  ALL_STUDENT_CAPABILITIES,
  assertGuardianCapability,
  AttachmentOperations,
  AuthorizationError,
  createGuardianActorMetadata,
  createStudentActorMetadata,
  effectiveGrantsForActor,
  GuardianCapability,
  StudentCapability,
  StudentOperations,
} from '../../../src/capabilities/authorization'
import { portalScopeForGuardian, portalScopeForStudent } from '../../support/effective-grants'

const now = new Date('2026-01-01T00:00:00Z')

const guardianActor = createGuardianActorMetadata({
  subjectId: 'guardian-subject',
  guardianId: 'guardian-1',
  schoolId: 'school-1',
  requestId: 'request-1',
  authenticatedAt: now,
  guardianScope: portalScopeForGuardian(['student-1']),
})

const studentActor = createStudentActorMetadata({
  subjectId: 'student-subject',
  studentId: 'student-1',
  schoolId: 'school-1',
  requestId: 'request-1',
  authenticatedAt: now,
  studentScope: portalScopeForStudent('student-1'),
})

describe('portal capability policy', () => {
  test('keeps guardian and student capability sets explicit and independent', () => {
    expect(ALL_GUARDIAN_CAPABILITIES).not.toEqual(ALL_STUDENT_CAPABILITIES)
    expect(ALL_GUARDIAN_CAPABILITIES).toContain(GuardianCapability.ReadSelfProfile)
    expect(Object.hasOwn(StudentCapability, 'ReadSelfProfile')).toBe(false)
    expect(effectiveGrantsForActor(guardianActor).permissions.size).toBe(0)
    expect(effectiveGrantsForActor(studentActor).permissions.size).toBe(0)
  })

  test('operations route portal reads through capabilities instead of authorize()', () => {
    expect(() => operationModule(StudentOperations.directoryRead)(guardianActor)).not.toThrow()
    expect(() => operationModule(StudentOperations.directoryRead)(studentActor)).not.toThrow()
    expect(() => operationModule(AttachmentOperations.read)(guardianActor)).not.toThrow()
    expect(() => operationModule(AttachmentOperations.read)(studentActor)).not.toThrow()

    expect(() => operationModule(StudentOperations.update)(guardianActor)).toThrow(AuthorizationError)
    expect(() => operationModule(StudentOperations.update)(studentActor)).toThrow(AuthorizationError)
  })

  test('assertGuardianCapability enforces linked student scope when targeted', () => {
    expect(() => assertGuardianCapability(
      guardianActor,
      GuardianCapability.ReadStudentDetail,
      { studentId: 'student-1' },
    )).not.toThrow()

    expect(() => assertGuardianCapability(
      guardianActor,
      GuardianCapability.ReadStudentDetail,
      { studentId: 'student-2' },
    )).toThrow(AuthorizationError)
  })
})
