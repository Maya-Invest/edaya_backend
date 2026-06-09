import type { EntityConfigFactory } from '../../shared'
import { Permission } from '../../authorization'
import { directPermissionEntityConfig } from '../../shared'
import { requireNonBlank, requireOptionalNonBlank, requireValidDate } from '../utils'

export type AccessRoleStatus = 'active' | 'inactive'

export interface AccessRoleArgs {
  id: string
  schoolId: string
  name: string
  description?: string | null
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
  readonly permissions: readonly Permission[]
  readonly status: AccessRoleStatus
  readonly createdAt: Date
  readonly updatedAt: Date

  constructor({
    id,
    schoolId,
    name,
    description,
    permissions,
    status = 'active',
    createdAt,
    updatedAt,
  }: AccessRoleArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.name = requireNonBlank(name, 'name')
    this.description = requireOptionalNonBlank(description, 'description')
    if (permissions.length === 0) {
      throw new Error('permissions must contain at least one entry')
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

export const accessRoleConfig: EntityConfigFactory<AccessRole> = input =>
  directPermissionEntityConfig(
    input,
    input.repositories.accessRoles,
    Permission.ACCESS_CONTROL_READ,
    Permission.ACCESS_CONTROL_CONFIGURE,
  )
