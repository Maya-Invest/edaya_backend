import type { Permission } from './permissions/permission'
import type { ScopeType } from './permissions/scope-type'

export interface AuthorizationRequest {
  actorId: string
  schoolId: string
  academicYearId?: string
  permission: Permission
  scopeType?: ScopeType
  scopeEntityId?: string
  context?: Record<string, unknown>
}
