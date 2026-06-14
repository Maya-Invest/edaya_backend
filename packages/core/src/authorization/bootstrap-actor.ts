import type { StaffActorMetadata } from './model/actor'
import { ELEVATED_STAFF_PERMISSIONS } from './grants/system-role-permissions'
import { ActorAssuranceLevel, createStaffActorMetadata } from './model/actor'
import { Permission } from './permissions/permission'

export interface BootstrapStaffActorMetadataInput {
  schoolId: string
  requestId: string
  staffMemberId?: string
  subjectId?: string
}

/** Synthetic elevated staff actor for platform bootstrap (school registration, dev seed). */
export function createBootstrapStaffActorMetadata(
  input: BootstrapStaffActorMetadataInput,
): StaffActorMetadata {
  return createStaffActorMetadata({
    subjectId: input.subjectId ?? 'bootstrap',
    staffMemberId: input.staffMemberId ?? 'bootstrap',
    schoolId: input.schoolId,
    requestId: input.requestId,
    authenticatedAt: new Date(),
    assuranceLevel: ActorAssuranceLevel.Strong,
    effectiveGrants: {
      permissions: new Set([
        Permission.PLATFORM_REGISTER_SCHOOL,
        ...ELEVATED_STAFF_PERMISSIONS,
      ]),
      scopeGrants: [],
      isElevated: true,
    },
  })
}
