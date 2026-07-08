import type { Permission } from '../permissions/permission'
import type { AuthorizationScopeType } from '../permissions/scope-type'

export interface AuthorizationRequest {
  schoolId: string
  permission: Permission
  scopeType?: AuthorizationScopeType
  scopeEntityId?: string
}
