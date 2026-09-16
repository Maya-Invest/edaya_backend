import type { Permission } from '@edaya/authorization'
import { StaffPermissionAssignment } from '@edaya/core'
import * as schema from '../postgres-schema'
import { PostgresStore } from '../postgres-store'

export class PostgresStaffPermissionAssignmentStore extends PostgresStore<StaffPermissionAssignment> {
  constructor(db: any) {
    super(
      db,
      schema.staffPermissionAssignments,
      (entity: StaffPermissionAssignment) => ({
        id: entity.id,
        staffId: entity.staffId,
        schoolId: entity.schoolId,
        academicYearId: entity.academicYearId,
        permission: entity.permission,
        scopes: entity.scopes,
        status: entity.status,
        startsAt: entity.startsAt ?? null,
        endsAt: entity.endsAt ?? null,
        sourceProfileId: entity.sourceProfileId ?? null,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      }),
      row => new StaffPermissionAssignment({
        id: row.id,
        staffId: row.staffId,
        schoolId: row.schoolId,
        academicYearId: row.academicYearId,
        permission: row.permission as Permission,
        scopes: row.scopes,
        status: row.status,
        startsAt: row.startsAt ?? undefined,
        endsAt: row.endsAt ?? undefined,
        sourceProfileId: row.sourceProfileId ?? undefined,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }),
    )
  }
}
