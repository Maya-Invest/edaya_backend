import { permissionScope } from '@edaya/core'
import type { Permission } from '../permissions/permission'
import { HUMAN_ONLY_PERMISSIONS } from '../permissions/permission-assurance'

const S2S_DENIED_PERMISSION_PREFIXES = [
  'SERVICE_ACCOUNT_',
  'ACCESS_CONTROL_',
] as const

export function isS2sDeniedPermission(permission: Permission): boolean {
  if (permissionScope(permission) === 'platform' || HUMAN_ONLY_PERMISSIONS.has(permission)) {
    return true
  }
  return S2S_DENIED_PERMISSION_PREFIXES.some(prefix => permission.startsWith(prefix))
}

export function isS2sReadPermission(permission: Permission): boolean {
  return permission.endsWith('_READ') || permission.startsWith('QUERY_')
}

export function s2sMayExercise(accessClass: 'read' | 'write', permission: Permission): boolean {
  if (isS2sDeniedPermission(permission)) {
    return false
  }
  if (accessClass === 'read') {
    return isS2sReadPermission(permission)
  }
  return true
}
