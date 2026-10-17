import type { Permission } from '../permissions/permission'
import { corePermissionDefinition } from '@edaya/core'

export function isS2sDeniedPermission(permission: Permission): boolean {
  return corePermissionDefinition(permission).s2sAccess === 'none'
}
export function isS2sReadPermission(permission: Permission): boolean {
  return corePermissionDefinition(permission).s2sAccess === 'read'
}
export function s2sMayExercise(accessClass: 'read' | 'write', permission: Permission): boolean {
  const allowed = corePermissionDefinition(permission).s2sAccess
  return allowed === 'read' || (allowed === 'write' && accessClass === 'write')
}
