import { ActorAssuranceLevel, createSchoolBootstrapActor, createStaffActorMetadata } from '@edaya/authorization'

/** Identity only. Tests must persist ownership or grants in their repository fixture. */
export function createTestStaffActor(schoolId = 'school', staffMemberId = 'staff-test') {
  return createStaffActorMetadata({ subjectId: 'subject-test', staffMemberId, schoolId, requestId: 'request', authenticatedAt: new Date('2026-01-01T00:00:00Z'), assuranceLevel: ActorAssuranceLevel.Strong })
}

export function createPlatformRegisterTestActor(schoolId = 'school') {
  return createSchoolBootstrapActor({ schoolId, requestId: 'request' })
}
