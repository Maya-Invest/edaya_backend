import { ActorAssuranceLevel, createStaffActorMetadata } from "@edaya/authorization";
import type { Permission } from "@edaya/core";

export const emptyEffectiveGrants = {
  permissions: new Set<Permission>(),
  scopeGrants: [],
  scopeIdsByPermission: {},
  isElevated: false,
};

export function createTestStaffActor() {
  return createStaffActorMetadata({
    schoolId: "school-1",
    subjectId: "auth-staff",
    requestId: "req-1",
    authenticatedAt: new Date("2026-01-01T00:00:00.000Z"),
    assuranceLevel: ActorAssuranceLevel.Standard,
    staffMemberId: "staff-1",
    effectiveGrants: emptyEffectiveGrants,
  });
}
