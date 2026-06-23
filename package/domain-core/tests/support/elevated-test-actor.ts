import type { StaffActorMetadata } from '../../src/authorization'
import { ActorAssuranceLevel, createBootstrapStaffActorMetadata, createStaffActorMetadata, ELEVATED_STAFF_PERMISSIONS } from '../../src/authorization'

const TEST_NOW = new Date('2026-01-01T00:00:00Z')

export function createElevatedTestStaffActor(
  schoolId = 'school',
  staffMemberId = 'staff-test',
): StaffActorMetadata {
  return createStaffActorMetadata({
    subjectId: 'subject-test',
    staffMemberId,
    schoolId,
    requestId: 'request',
    authenticatedAt: TEST_NOW,
    assuranceLevel: ActorAssuranceLevel.Strong,
    effectiveGrants: {
      permissions: new Set(ELEVATED_STAFF_PERMISSIONS),
      scopeGrants: [],
      isElevated: true,
    },
  })
}

export function createPlatformRegisterTestActor(schoolId = 'school'): StaffActorMetadata {
  return createBootstrapStaffActorMetadata({
    schoolId,
    requestId: 'request',
    staffMemberId: 'staff-bootstrap',
    subjectId: 'subject-bootstrap',
  })
}
