import type { Permission } from './permissions/permission'
import type { ScopeType } from './permissions/scope-type'

export interface AuthorizationRequest {
  schoolId: string
  academicYearId?: string
  permission: Permission
  scopeType?: ScopeType
  scopeEntityId?: string
}
