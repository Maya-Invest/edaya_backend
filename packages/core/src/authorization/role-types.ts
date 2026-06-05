import type { Permission } from './permissions/permission'
import type { ScopeType } from './permissions/scope-type'

/** School-defined bundle of permissions; persisted as `AccessRole`. */
export interface Role {
  id: string
  schoolId: string
  name: string
  description?: string
  isSystemRole: boolean
  permissions: readonly Permission[]
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

/** Limits a single permission to specific scope entities. */
export interface ScopeGrant {
  permission: Permission
  scopeType: ScopeType
  scopeEntityIds: readonly string[]
}

/** Staff access grant for one school (and optionally one academic year). */
export interface RoleAssignment {
  id: string
  staffId: string
  schoolId: string
  academicYearId?: string
  roleIds: readonly string[]
  scopeGrants: readonly ScopeGrant[]
  status: 'active' | 'inactive' | 'expired'
  startsAt?: string
  endsAt?: string
  createdAt: string
  updatedAt: string
}
