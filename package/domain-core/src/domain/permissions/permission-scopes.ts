import type { ScopeType } from './scope-type'
import { Permission } from './permission'
import { corePermissionDefinition } from './permission-catalog'

/** @deprecated Use scopePolicy.allowedKinds; a capability can support multiple grains. */
export function permissionScope(permission: Permission): ScopeType | undefined {
  const policy = corePermissionDefinition(permission).scopePolicy
  return policy.mode === 'platform' ? 'platform' : policy.mode === 'resources' ? policy.allowedKinds[0] : undefined
}
export const PERMISSION_SCOPE_OVERRIDES: Readonly<Partial<Record<Permission, ScopeType>>> = Object.freeze(Object.fromEntries(Object.values(Permission).flatMap((permission) => {
  const scope = permissionScope(permission)
  return scope ? [[permission, scope]] : []
})))
