import type { Permission } from '../../authorization/permissions/permission'
import type { StaffRole } from './staff-member'
import { requireNonBlank, requireOptionalNonBlank, requireValidDate } from '../utils'

export type AccessRoleStatus = 'active' | 'inactive'

export interface AccessRoleArgs {
  id: string
  schoolId: string
  name: string
  description?: string | null
  isSystemRole: boolean
  systemRoleKey?: StaffRole | null
  permissions: readonly Permission[]
  status?: AccessRoleStatus
  createdAt?: Date
  updatedAt?: Date
}

/** School-scoped role definition (system templates or custom roles). */
export class AccessRole {
  readonly id: string
  readonly schoolId: string
  readonly name: string
  readonly description?: string
  readonly isSystemRole: boolean
  readonly systemRoleKey?: StaffRole
  readonly permissions: readonly Permission[]
  readonly status: AccessRoleStatus
  readonly createdAt: Date
  readonly updatedAt: Date

  constructor({
    id,
    schoolId,
    name,
    description,
    isSystemRole,
    systemRoleKey,
    permissions,
    status = 'active',
    createdAt,
    updatedAt,
  }: AccessRoleArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.name = requireNonBlank(name, 'name')
    this.description = requireOptionalNonBlank(description, 'description')
    this.isSystemRole = isSystemRole
    this.systemRoleKey = systemRoleKey ?? undefined
    if (permissions.length === 0 && !isSystemRole) {
      throw new Error('permissions must contain at least one entry for custom roles')
    }
    this.permissions = Object.freeze([...new Set(permissions)])
    if (status !== 'active' && status !== 'inactive') {
      throw new Error(`Invalid access role status: ${status}`)
    }
    this.status = status
    const now = new Date()
    this.createdAt = createdAt ? requireValidDate(createdAt, 'createdAt') : now
    this.updatedAt = updatedAt ? requireValidDate(updatedAt, 'updatedAt') : this.createdAt
  }
}
