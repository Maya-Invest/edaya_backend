import type { ScopeGrant } from '../model/scope-grant'
import type { Permission } from '../permissions/permission'
import { ASSIGNMENT_SCOPED_PERMISSION_SET } from '../permissions/assignment-scoped-permissions'
import { permissionDefinitions } from '../permissions/permission-definitions'
import { scopeIdsFromEntityIds } from '../scope/scope-ids-from-entities'

export function scopeIdsFromLegacyScopeGrant(grant: ScopeGrant): string {
  if (grant.scopeType === 'school' || grant.scopeEntityIds.length === 0) {
    return ''
  }
  return scopeIdsFromEntityIds(grant.scopeEntityIds)
}

export function mergePermissionScopeIds(existing: string | undefined, incoming: string): string {
  if (incoming === '') {
    return existing ?? ''
  }
  if (!existing || existing === '') {
    return incoming
  }
  if (existing === incoming) {
    return existing
  }
  return `${existing};${incoming}`
}

export function buildScopeIdsByPermissionFromLegacyAccess(
  permissions: Iterable<Permission>,
  scopeGrants: readonly ScopeGrant[],
): Map<Permission, string> {
  const byPermission = new Map<Permission, string>()

  for (const grant of scopeGrants) {
    if (grant.scopeType === 'school' && permissionDefinitions[grant.permission].scope) {
      continue
    }
    const scopeIds = scopeIdsFromLegacyScopeGrant(grant)
    byPermission.set(
      grant.permission,
      mergePermissionScopeIds(byPermission.get(grant.permission), scopeIds),
    )
  }

  for (const permission of permissions) {
    if (byPermission.has(permission)) {
      continue
    }
    if (!permissionDefinitions[permission].scope && !ASSIGNMENT_SCOPED_PERMISSION_SET.has(permission)) {
      byPermission.set(permission, '')
    }
  }

  return byPermission
}

export interface LegacyRoleAssignmentMigrationRow {
  staffId: string
  schoolId: string
  academicYearId?: string
  roleIds: readonly string[]
  scopeGrants: readonly ScopeGrant[]
  status: 'active' | 'inactive' | 'expired'
  startsAt?: Date
  endsAt?: Date
}

export interface LegacyAccessRolePermissions {
  readonly id: string
  readonly permissions: readonly Permission[]
}

export interface StaffPermissionAssignmentMigrationRow {
  staffId: string
  schoolId: string
  academicYearId: string
  permission: Permission
  scopeIds: string
  status: 'active' | 'inactive' | 'expired'
  startsAt?: Date
  endsAt?: Date
}

export function expandLegacyStaffAccessToPermissionRows(args: {
  roleAssignments: readonly LegacyRoleAssignmentMigrationRow[]
  accessRoles: readonly LegacyAccessRolePermissions[]
  defaultAcademicYearId: string
}): StaffPermissionAssignmentMigrationRow[] {
  const rolesById = new Map(args.accessRoles.map(role => [role.id, role]))
  const rows: StaffPermissionAssignmentMigrationRow[] = []

  for (const assignment of args.roleAssignments) {
    const academicYearId = assignment.academicYearId ?? args.defaultAcademicYearId
    const permissions = new Set<Permission>()
    for (const roleId of assignment.roleIds) {
      const role = rolesById.get(roleId)
      if (!role) {
        continue
      }
      for (const permission of role.permissions) {
        permissions.add(permission)
      }
    }

    const scopeIdsByPermission = buildScopeIdsByPermissionFromLegacyAccess(
      permissions,
      assignment.scopeGrants,
    )

    for (const permission of permissions) {
      const scopeIds = scopeIdsByPermission.get(permission)
      if (scopeIds === undefined) {
        continue
      }
      rows.push({
        staffId: assignment.staffId,
        schoolId: assignment.schoolId,
        academicYearId,
        permission,
        scopeIds,
        status: assignment.status,
        ...(assignment.startsAt ? { startsAt: assignment.startsAt } : {}),
        ...(assignment.endsAt ? { endsAt: assignment.endsAt } : {}),
      })
    }
  }

  return rows
}

export function permissionRowsFromTemplatePermissions(
  staffId: string,
  schoolId: string,
  academicYearId: string,
  permissions: readonly Permission[],
  scopeGrants: readonly ScopeGrant[] = [],
): StaffPermissionAssignmentMigrationRow[] {
  const permissionSet = new Set(permissions)
  const scopeIdsByPermission = buildScopeIdsByPermissionFromLegacyAccess(permissionSet, scopeGrants)

  return [...permissionSet].map(permission => ({
    staffId,
    schoolId,
    academicYearId,
    permission,
    scopeIds: scopeIdsByPermission.get(permission) ?? '',
    status: 'active' as const,
  })).filter(row => scopeIdsByPermission.has(row.permission))
}
