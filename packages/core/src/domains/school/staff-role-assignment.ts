import type { ScopeGrant } from '../../authorization/role-types'
import type { EntityConfigFactory } from '../../shared'
import { Permission } from '../../authorization'
import { directPermissionEntityConfig } from '../../shared'
import { requireNonBlank, requireOptionalNonBlank, requireValidDate } from '../utils'

export type StaffRoleAssignmentStatus = 'active' | 'inactive' | 'expired'

export interface StaffRoleAssignmentArgs {
  id: string
  staffId: string
  schoolId: string
  academicYearId?: string | null
  roleIds: readonly string[]
  scopeGrants?: readonly ScopeGrant[]
  status?: StaffRoleAssignmentStatus
  startsAt?: Date | null
  endsAt?: Date | null
  createdAt?: Date
  updatedAt?: Date
}

/** Persisted staff access grant (roles + per-permission scope). */
export class StaffRoleAssignment {
  readonly id: string
  readonly staffId: string
  readonly schoolId: string
  readonly academicYearId?: string
  readonly roleIds: readonly string[]
  readonly scopeGrants: readonly ScopeGrant[]
  readonly status: StaffRoleAssignmentStatus
  readonly startsAt?: Date
  readonly endsAt?: Date
  readonly createdAt: Date
  readonly updatedAt: Date

  constructor({
    id,
    staffId,
    schoolId,
    academicYearId,
    roleIds,
    scopeGrants = [],
    status = 'active',
    startsAt,
    endsAt,
    createdAt,
    updatedAt,
  }: StaffRoleAssignmentArgs) {
    this.id = requireNonBlank(id, 'id')
    this.staffId = requireNonBlank(staffId, 'staffId')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.academicYearId = requireOptionalNonBlank(academicYearId, 'academicYearId')
    const uniqueRoleIds = [...new Set(roleIds)]
    if (uniqueRoleIds.length === 0) {
      throw new Error('roleIds must contain at least one role')
    }
    this.roleIds = Object.freeze(uniqueRoleIds)
    this.scopeGrants = Object.freeze(scopeGrants.map(grant => Object.freeze({
      ...grant,
      scopeEntityIds: Object.freeze([...grant.scopeEntityIds]),
    })))
    if (status !== 'active' && status !== 'inactive' && status !== 'expired') {
      throw new Error(`Invalid staff role assignment status: ${status}`)
    }
    this.status = status
    this.startsAt = startsAt ? requireValidDate(startsAt, 'startsAt') : undefined
    this.endsAt = endsAt ? requireValidDate(endsAt, 'endsAt') : undefined
    const now = new Date()
    this.createdAt = createdAt ? requireValidDate(createdAt, 'createdAt') : now
    this.updatedAt = updatedAt ? requireValidDate(updatedAt, 'updatedAt') : this.createdAt
  }
}

export const staffRoleAssignmentConfig: EntityConfigFactory<StaffRoleAssignment> = input =>
  directPermissionEntityConfig(
    input,
    input.repositories.staffRoleAssignments,
    Permission.ACCESS_CONTROL_READ,
    Permission.ACCESS_CONTROL_ASSIGN,
  )
