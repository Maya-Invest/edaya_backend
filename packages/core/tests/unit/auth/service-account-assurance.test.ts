import { describe, expect, test } from 'bun:test'
import {
  ActorAssuranceLevel,
  assertCommandActorKind,
  AuthorizationError,
  authorize,
  createServiceStaffActorMetadata,
  createStaffActorMetadata,
  Permission,
} from '../../../src/authorization'
import { effectiveGrantsForRoles } from '../../support/effective-grants'

const now = new Date('2026-01-01T00:00:00Z')

describe('service account assurance and account kind', () => {
  test('createServiceStaffActorMetadata sets service assurance and account kind', () => {
    const actor = createServiceStaffActorMetadata({
      subjectId: 'service-subject',
      staffMemberId: 'staff-service-1',
      schoolId: 'school-1',
      requestId: 'request-1',
      authenticatedAt: now,
      effectiveGrants: effectiveGrantsForRoles(['admin']),
    })

    expect(actor.accountKind).toBe('service')
    expect(actor.assuranceLevel).toBe(ActorAssuranceLevel.Service)
  })

  test('service accounts cannot manage other service accounts', () => {
    const actor = createServiceStaffActorMetadata({
      subjectId: 'service-subject',
      staffMemberId: 'staff-service-1',
      schoolId: 'school-1',
      requestId: 'request-1',
      authenticatedAt: now,
      effectiveGrants: effectiveGrantsForRoles(['admin']),
    })

    expect(() => authorize({
      actor,
      request: {
        schoolId: 'school-1',
        permission: Permission.SERVICE_ACCOUNT_CREATE,
      },
    })).toThrow(AuthorizationError)
  })

  test('non-elevated human staff need verified assurance to create service accounts', () => {
    const actor = createStaffActorMetadata({
      subjectId: 'subject-staff',
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      requestId: 'request-1',
      authenticatedAt: now,
      assuranceLevel: ActorAssuranceLevel.Standard,
      effectiveGrants: effectiveGrantsForRoles(['teacher']),
    })

    expect(() => authorize({
      actor,
      request: {
        schoolId: 'school-1',
        permission: Permission.SERVICE_ACCOUNT_CREATE,
      },
    })).toThrow(AuthorizationError)
  })

  test('elevated school owners may create service accounts with standard assurance', () => {
    const actor = createStaffActorMetadata({
      subjectId: 'subject-staff',
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      requestId: 'request-1',
      authenticatedAt: now,
      assuranceLevel: ActorAssuranceLevel.Standard,
      effectiveGrants: effectiveGrantsForRoles(['admin']),
    })

    expect(() => authorize({
      actor,
      request: {
        schoolId: 'school-1',
        permission: Permission.SERVICE_ACCOUNT_CREATE,
      },
    })).not.toThrow()
  })

  test('verified human staff can create service accounts', () => {
    const actor = createStaffActorMetadata({
      subjectId: 'subject-staff',
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      requestId: 'request-1',
      authenticatedAt: now,
      assuranceLevel: ActorAssuranceLevel.Verified,
      effectiveGrants: effectiveGrantsForRoles(['admin']),
    })

    expect(() => authorize({
      actor,
      request: {
        schoolId: 'school-1',
        permission: Permission.SERVICE_ACCOUNT_CREATE,
      },
    })).not.toThrow()
  })

  test('elevated service accounts may configure access control for operational seeding', () => {
    const actor = createServiceStaffActorMetadata({
      subjectId: 'service-subject',
      staffMemberId: 'staff-service-1',
      schoolId: 'school-1',
      requestId: 'request-1',
      authenticatedAt: now,
      effectiveGrants: {
        ...effectiveGrantsForRoles(['admin']),
        isElevated: true,
      },
    })

    expect(() => authorize({
      actor,
      request: {
        schoolId: 'school-1',
        permission: Permission.ACCESS_CONTROL_CONFIGURE,
      },
    })).not.toThrow()
  })

  test('non-elevated service accounts cannot configure access control', () => {
    const actor = createServiceStaffActorMetadata({
      subjectId: 'service-subject',
      staffMemberId: 'staff-service-1',
      schoolId: 'school-1',
      requestId: 'request-1',
      authenticatedAt: now,
      effectiveGrants: effectiveGrantsForRoles(['accountant']),
    })

    expect(() => authorize({
      actor,
      request: {
        schoolId: 'school-1',
        permission: Permission.ACCESS_CONTROL_CONFIGURE,
      },
    })).toThrow(AuthorizationError)
  })

  test('service accounts skip human assurance ladder for operational permissions', () => {
    const actor = createServiceStaffActorMetadata({
      subjectId: 'service-subject',
      staffMemberId: 'staff-service-1',
      schoolId: 'school-1',
      requestId: 'request-1',
      authenticatedAt: now,
      effectiveGrants: effectiveGrantsForRoles(['accountant']),
    })

    expect(() => authorize({
      actor,
      request: {
        schoolId: 'school-1',
        permission: Permission.PAYMENT_RECORD,
      },
    })).not.toThrow()
  })
})

describe('service-only command gate', () => {
  test('allows service accounts to call service-only commands', () => {
    const actor = createServiceStaffActorMetadata({
      subjectId: 'service-subject',
      staffMemberId: 'staff-service-1',
      schoolId: 'school-1',
      requestId: 'request-1',
      authenticatedAt: now,
      effectiveGrants: effectiveGrantsForRoles(['admin']),
    })

    expect(() => assertCommandActorKind(actor, { serviceOnly: true })).not.toThrow()
  })

  test('rejects human staff on service-only commands', () => {
    const actor = createStaffActorMetadata({
      subjectId: 'subject-staff',
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      requestId: 'request-1',
      authenticatedAt: now,
      assuranceLevel: ActorAssuranceLevel.Verified,
      effectiveGrants: effectiveGrantsForRoles(['admin']),
    })

    expect(() => assertCommandActorKind(actor, { serviceOnly: true })).toThrow(AuthorizationError)
  })

  test('allows any actor when serviceOnly is not set', () => {
    const actor = createStaffActorMetadata({
      subjectId: 'subject-staff',
      staffMemberId: 'staff-1',
      schoolId: 'school-1',
      requestId: 'request-1',
      authenticatedAt: now,
      assuranceLevel: ActorAssuranceLevel.Verified,
      effectiveGrants: effectiveGrantsForRoles(['admin']),
    })

    expect(() => assertCommandActorKind(actor, {})).not.toThrow()
  })
})
