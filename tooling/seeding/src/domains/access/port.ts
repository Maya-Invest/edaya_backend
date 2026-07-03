import type { Permission, ScopeGrantInput } from '@edaya/core'

export interface StaffPermissionAssignmentSeedRecord {
  id: string
  staffId: string
  schoolId: string
  academicYearId: string
  permission: Permission
  scopeIds: string
  status: 'active'
}

export interface StaffAssignmentSeedRecord {
  id: string
  staffId: string
  academicYearId: string
  responsibility: string
  permissions?: readonly Permission[]
  classGroupId?: string
  classSubjectId?: string
  lessonSessionId?: string
}

export interface AccessSeedPort {
  schoolExists: (schoolId: string) => Promise<boolean>
  saveStaffPermissionAssignment: (record: StaffPermissionAssignmentSeedRecord) => Promise<void>
  saveStaffAssignment: (record: StaffAssignmentSeedRecord) => Promise<void>
}

/** @deprecated Preset permission list used when expanding dev seeds. */
export interface AccessRolePresetRecord {
  id: string
  schoolId: string
  name: string
  permissions: readonly Permission[]
}

/** @deprecated Used only to expand preset rows into permission assignments. */
export interface StaffRoleAssignmentPresetRecord {
  staffId: string
  schoolId: string
  academicYearId: string
  roleId: string
  scopeGrants?: readonly ScopeGrantInput[]
  status: 'active'
}
