import type { StaffPermissionAssignment } from '@edaya/core'
import type { EffectiveGrants } from '../model/effective-grants'
import type { Permission } from '../permissions/permission'
import { mergeScopeIdClauses } from '../scope/scope-ids-parse'

export function mergeStaffPermissionAssignments(
  rows: readonly StaffPermissionAssignment[],
): {
  permissions: Set<Permission>
  scopeIdsByPermission: Partial<Record<Permission, string>>
} {
  const scopeParts = new Map<Permission, string[]>()
  const permissions = new Set<Permission>()

  for (const row of rows) {
    permissions.add(row.permission)
    const parts = scopeParts.get(row.permission) ?? []
    if (row.scopeIds) {
      parts.push(row.scopeIds)
    }
    scopeParts.set(row.permission, parts)
  }

  const scopeIdsByPermission: Partial<Record<Permission, string>> = {}
  for (const [permission, parts] of scopeParts) {
    const merged = mergeScopeIdClauses(...parts)
    scopeIdsByPermission[permission] = merged
  }

  return { permissions, scopeIdsByPermission }
}

export function effectiveGrantsFromStaffPermissionAssignments(
  rows: readonly StaffPermissionAssignment[],
  args: { expiresAt?: Date } = {},
): EffectiveGrants {
  const { permissions, scopeIdsByPermission } = mergeStaffPermissionAssignments(rows)

  return {
    permissions,
    scopeGrants: [],
    scopeIdsByPermission,
    isElevated: false,
    ...args,
  }
}
