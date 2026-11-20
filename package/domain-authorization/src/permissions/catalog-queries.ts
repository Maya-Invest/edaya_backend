import type { ScopeType } from './scope-type'
import { Permission } from './permission'
import { permissionDefinitions } from './permission-definitions'

export function listPermissionsWithCatalogScope(scope: ScopeType): readonly Permission[] {
  return Object.values(Permission).filter(
    (permission) => {
      const policy = permissionDefinitions[permission].scopePolicy
      return scope === 'platform' ? policy.mode === 'platform' : policy.mode === 'resources' && policy.allowedKinds.includes(scope)
    },
  )
}

export function listTenantWidePermissions(): readonly Permission[] {
  return Object.values(Permission).filter(
    permission => permissionDefinitions[permission].scopePolicy.mode === 'none',
  )
}

export function listPermissionCatalog() {
  return Object.freeze(Object.values(permissionDefinitions))
}
export function getPermissionCatalogEntry(permission: Permission) {
  return permissionDefinitions[permission]
}
