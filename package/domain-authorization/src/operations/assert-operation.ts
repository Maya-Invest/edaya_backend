import type { GuardianCapabilityTarget } from '../capabilities/assert-guardian-capability'
import type { HomeroomCapabilityTarget } from '../capabilities/assert-homeroom-capability'
import type { StudentCapabilityTarget } from '../capabilities/assert-student-capability'
import type { TeachingCapabilityTarget } from '../capabilities/assert-teaching-capability'
import type { HomeroomCapability } from '../capabilities/homeroom-capability'
import type { TeachingCapability } from '../capabilities/teaching-capability'
import type { ActorMetadata, PlatformActorMetadata, S2sActorMetadata, TeacherActorMetadata } from '../model/actor'
import type { AuthorizationRequest } from '../model/request'
import type { OperationContext, OperationRef, OperationTargetKey, StaffOperationRule, TeacherOperationRule } from './types'
import {
  assertGuardianCapability,
} from '../capabilities/assert-guardian-capability'
import {
  assertHomeroomCapability,
} from '../capabilities/assert-homeroom-capability'
import {
  assertStudentCapability,
} from '../capabilities/assert-student-capability'
import {
  assertTeachingCapability,
} from '../capabilities/assert-teaching-capability'
import { ALL_HOMEROOM_CAPABILITIES } from '../capabilities/homeroom-capability'
import { ALL_TEACHING_CAPABILITIES } from '../capabilities/teaching-capability'
import { authorize } from '../engine/authorize'
import { AuthorizationError, AuthorizationErrorCode } from '../model/errors'
import { s2sMayExercise } from '../s2s/access-class'

export type AssertOperationMode = 'full' | 'module'

function teacherHasAnyAssignment(actor: TeacherActorMetadata): boolean {
  return actor.teacherScope.teaching.classSubjectIds.length > 0
    || actor.teacherScope.homeroom.classGroupIds.length > 0
}

function buildStaffScope(
  scopeFrom: OperationTargetKey | undefined,
  context?: OperationContext,
): Pick<AuthorizationRequest, 'scopeType' | 'scopeEntityId'> | undefined {
  if (!scopeFrom || scopeFrom === 'none' || !context) {
    return undefined
  }

  if (scopeFrom === 'student' && context.studentId) {
    return { scopeType: 'student', scopeEntityId: context.studentId }
  }
  if (scopeFrom === 'classGroup' && context.classGroupId) {
    return { scopeType: 'class_group', scopeEntityId: context.classGroupId }
  }
  if (scopeFrom === 'classSubject' && context.classSubjectId) {
    return { scopeType: 'class_subject', scopeEntityId: context.classSubjectId }
  }

  return undefined
}

function guardianTarget(context?: OperationContext): GuardianCapabilityTarget | undefined {
  if (!context) {
    return undefined
  }
  return {
    ...(context.studentId ? { studentId: context.studentId } : {}),
    ...(context.classGroupId ? { classGroupId: context.classGroupId } : {}),
  }
}

function studentTarget(context?: OperationContext): StudentCapabilityTarget | undefined {
  if (!context) {
    return undefined
  }
  return {
    ...(context.studentId ? { studentId: context.studentId } : {}),
    ...(context.classGroupId ? { classGroupId: context.classGroupId } : {}),
  }
}

function teachingTarget(context?: OperationContext): TeachingCapabilityTarget | undefined {
  return context?.classSubjectId ? { classSubjectId: context.classSubjectId } : undefined
}

function homeroomTarget(context?: OperationContext): HomeroomCapabilityTarget | undefined {
  return context?.classGroupId ? { classGroupId: context.classGroupId } : undefined
}

function isTeachingCapabilityValue(value: string): value is TeachingCapability {
  return (ALL_TEACHING_CAPABILITIES as readonly string[]).includes(value)
}

function isHomeroomCapabilityValue(value: string): value is HomeroomCapability {
  return (ALL_HOMEROOM_CAPABILITIES as readonly string[]).includes(value)
}

function assertTeacherRule(
  actor: TeacherActorMetadata,
  rule: TeacherOperationRule,
  context: OperationContext | undefined,
  mode: AssertOperationMode,
): void {
  if ('allow' in rule) {
    return
  }
  if ('anyOf' in rule) {
    let lastError: unknown
    for (const child of rule.anyOf) {
      try {
        assertTeacherRule(actor, child, context, mode)
        return
      }
      catch (error) {
        lastError = error
      }
    }
    throw lastError
  }

  if (isTeachingCapabilityValue(rule.capability)) {
    if (mode === 'module' && !context?.classSubjectId) {
      if (!rule.target || rule.target === 'classSubject') {
        if (!teacherHasAnyAssignment(actor)) {
          throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
        }
        if (!rule.target) {
          return
        }
      }
    }
    assertTeachingCapability(actor, rule.capability, teachingTarget(context))
    return
  }

  if (isHomeroomCapabilityValue(rule.capability)) {
    if (mode === 'module' && !context?.classGroupId) {
      if (!rule.target || rule.target === 'classGroup') {
        if (!teacherHasAnyAssignment(actor)) {
          throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
        }
        if (!rule.target) {
          return
        }
      }
    }
    assertHomeroomCapability(actor, rule.capability, homeroomTarget(context))
    return
  }

  throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
}

function assertStaffRule(
  actor: ActorMetadata,
  operation: OperationRef,
  context: OperationContext | undefined,
): void {
  const staff = operation.definition.staff
  if (!staff || actor.kind !== 'staff') {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  if ('anyOf' in staff) {
    let lastError: unknown
    for (const rule of staff.anyOf) {
      try {
        authorize({
          actor,
          request: {
            schoolId: actor.schoolId,
            permission: rule.permission,
            ...buildStaffScope(rule.scopeFrom, context),
          },
        })
        return
      }
      catch (error) {
        lastError = error
      }
    }
    throw lastError
  }

  authorize({
    actor,
    request: {
      schoolId: actor.schoolId,
      permission: staff.permission,
      ...buildStaffScope(staff.scopeFrom, context),
    },
  })
}

function staffPermissions(rule: StaffOperationRule): readonly { permission: AuthorizationRequest['permission'] }[] {
  if ('anyOf' in rule) {
    return rule.anyOf
  }
  return [rule]
}

function assertPlatformRule(actor: PlatformActorMetadata, operation: OperationRef): void {
  const rule = operation.definition.platform
  if (!rule) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  if (!actor.permissions.has(rule.permission)) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}

function assertS2sRule(actor: S2sActorMetadata, operation: OperationRef): void {
  if (operation.definition.platform || !operation.definition.staff) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  const permissions = staffPermissions(operation.definition.staff)
  if (!permissions.some(rule => s2sMayExercise(actor.accessClass, rule.permission))) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}

function ensureRequiredContext(
  operation: OperationRef,
  context: OperationContext | undefined,
  mode: AssertOperationMode,
): void {
  if (mode === 'module' || operation.definition.global || !operation.definition.requiresContext?.length) {
    return
  }

  for (const key of operation.definition.requiresContext) {
    if (!context?.[key]) {
      throw new AuthorizationError(
        AuthorizationErrorCode.Forbidden,
        `Operation ${operation.id} requires context ${key}`,
      )
    }
  }
}

export function assertOperation(
  actor: ActorMetadata,
  operation: OperationRef,
  context?: OperationContext,
  mode: AssertOperationMode = 'full',
): void {
  if (actor.kind === 'system') {
    return
  }

  const definition = operation.definition

  if (actor.kind === 'staff') {
    if (!definition.staff) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
    ensureRequiredContext(operation, context, mode)
    assertStaffRule(actor, operation, context)
    return
  }

  if (actor.kind === 'teacher') {
    if (!definition.teacher) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
    ensureRequiredContext(operation, context, mode)
    assertTeacherRule(actor, definition.teacher, context, mode)
    return
  }

  if (actor.kind === 'guardian') {
    if (!definition.guardian) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
    ensureRequiredContext(operation, context, mode)
    assertGuardianCapability(actor, definition.guardian.capability, guardianTarget(context))
    return
  }

  if (actor.kind === 'student') {
    if (!definition.student) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
    ensureRequiredContext(operation, context, mode)
    assertStudentCapability(actor, definition.student.capability, studentTarget(context))
    return
  }

  if (actor.kind === 'platform') {
    ensureRequiredContext(operation, context, mode)
    assertPlatformRule(actor, operation)
    return
  }

  if (actor.kind === 's2s') {
    ensureRequiredContext(operation, context, mode)
    assertS2sRule(actor, operation)
    return
  }

  throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
}
