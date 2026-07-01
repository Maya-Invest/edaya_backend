import type { Permission, ScopeGrantInput } from '@edaya/core'

export interface AccessRoleSeedRecord {
  id: string
  schoolId: string
  name: string
  permissions: readonly Permission[]
}

export interface StaffRoleAssignmentSeedRecord {
  id: string
  staffId: string
  schoolId: string
  academicYearId: string
  roleIds: readonly string[]
  scopeGrants: readonly ScopeGrantInput[]
  status: 'active'
}

export interface StaffAssignmentSeedRecord {
  id: string
  staffId: string
  responsibility: string
  classGroupId?: string
  classSubjectId?: string
  lessonSessionId?: string
}

export interface AccessSeedPort {
  schoolExists: (schoolId: string) => Promise<boolean>
  saveAccessRole: (record: AccessRoleSeedRecord) => Promise<void>
  saveStaffRoleAssignment: (record: StaffRoleAssignmentSeedRecord) => Promise<void>
  saveStaffAssignment: (record: StaffAssignmentSeedRecord) => Promise<void>
}
