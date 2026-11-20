import type { GrantScope, Permission, UserScopeSelection } from '@edaya/core'

export interface StaffPermissionAssignmentSeedRecord {
  id: string
  staffId: string
  schoolId: string
  academicYearId: string
  permission: Permission
  scopes: GrantScope[]
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

export interface PermissionProfileSeedRecord {
  id: string
  sourceKey?: string
  permissions: readonly Permission[]
}

export interface ApplyStaffPermissionProfileSeedRecord {
  staffId: string
  profileId: string
  academicYearId: string
  customScopes: UserScopeSelection[]
  useDefaultScopes: boolean
}

export interface AccessSeedPort {
  schoolExists: (schoolId: string) => Promise<boolean>
  saveStaffPermissionAssignment: (record: StaffPermissionAssignmentSeedRecord) => Promise<void>
  saveStaffAssignment: (record: StaffAssignmentSeedRecord) => Promise<void>
  listPermissionProfiles: (schoolId: string) => Promise<readonly PermissionProfileSeedRecord[]>
  applyStaffPermissionProfile: (record: ApplyStaffPermissionProfileSeedRecord) => Promise<void>
}

export interface AccessRolePresetRecord {
  id: string
  schoolId: string
  name: string
  permissions: readonly Permission[]
}

export interface StaffRoleAssignmentPresetRecord {
  staffId: string
  schoolId: string
  academicYearId: string
  roleId: string
  scopesByPermission?: Readonly<Partial<Record<Permission, readonly GrantScope[]>>>
  status: 'active'
}
