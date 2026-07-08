import type { ScopeType } from './scope-type'
import { Permission } from './permission'
import { permissionDefinitions } from './permission-definitions'

export function listPermissionsWithCatalogScope(scope: ScopeType): readonly Permission[] {
  return Object.values(Permission).filter(
    permission => permissionDefinitions[permission].scope === scope,
  )
}

export function listTenantWidePermissions(): readonly Permission[] {
  return Object.values(Permission).filter(
    permission => permissionDefinitions[permission].scope === undefined,
  )
}
