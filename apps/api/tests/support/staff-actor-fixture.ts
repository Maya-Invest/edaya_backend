import { ActorAssuranceLevel, createStaffActorMetadata } from "@edaya/authorization";

export function createTestStaffActor() {
  return createStaffActorMetadata({
    schoolId: "school-1",
    subjectId: "auth-staff",
    requestId: "req-1",
    authenticatedAt: new Date("2026-01-01T00:00:00.000Z"),
    assuranceLevel: ActorAssuranceLevel.Standard,
    staffMemberId: "staff-1",
  });
}
