import type { GuardianCapability } from '../capabilities/guardian-capability'
import type { HomeroomCapability } from '../capabilities/homeroom-capability'
import type { StudentCapability } from '../capabilities/student-capability'
import type { TeachingCapability } from '../capabilities/teaching-capability'
import type { Permission } from '../permissions/permission'
import type { PlatformPermission } from '../permissions/platform-permission'

export type OperationTargetKey = 'student' | 'classGroup' | 'classSubject' | 'none'

export type OperationContextKey = 'studentId' | 'classGroupId' | 'classSubjectId'

export interface OperationContext {
  readonly studentId?: string
  readonly classGroupId?: string
  readonly classSubjectId?: string
}

export type PortalCapability
  = | TeachingCapability
    | HomeroomCapability
    | GuardianCapability
    | StudentCapability

export interface PortalOperationRule<C extends PortalCapability> {
  readonly capability: C
  readonly target?: OperationTargetKey
}

export type GuardianOperationRule = PortalOperationRule<GuardianCapability>
export type StudentOperationRule = PortalOperationRule<StudentCapability>

export type TeacherOperationRule
  = | PortalOperationRule<TeachingCapability>
    | PortalOperationRule<HomeroomCapability>
    | { readonly anyOf: readonly TeacherOperationRule[] }
    | { readonly allow: true }

export type StaffOperationRule
  = | { readonly permission: Permission, readonly scopeFrom?: OperationTargetKey }
    | { readonly anyOf: readonly { readonly permission: Permission, readonly scopeFrom?: OperationTargetKey }[] }

export interface PlatformOperationRule { readonly permission: PlatformPermission }

export interface OperationDefinition {
  readonly id: string
  readonly requiresContext?: readonly OperationContextKey[]
  readonly global?: boolean
  readonly staff?: StaffOperationRule
  readonly teacher?: TeacherOperationRule
  readonly guardian?: GuardianOperationRule
  readonly student?: StudentOperationRule
  readonly platform?: PlatformOperationRule
}

export interface OperationRef {
  readonly id: string
  readonly definition: OperationDefinition
}
