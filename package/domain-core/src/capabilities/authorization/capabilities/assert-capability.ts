import type { InteractiveActorMetadata } from '../model/actor'
import type { AuthorizationRequest } from '../model/request'
import type { GuardianCapabilityTarget } from './assert-guardian-capability'
import type { HomeroomCapabilityTarget } from './assert-homeroom-capability'
import type { StudentCapabilityTarget } from './assert-student-capability'
import type { TeachingCapabilityTarget } from './assert-teaching-capability'
import { isInteractiveActor } from '../model/actor'
import { AuthorizationError, AuthorizationErrorCode } from '../model/errors'
import { assertGuardianCapability } from './assert-guardian-capability'
import { assertHomeroomCapability } from './assert-homeroom-capability'
import { assertStudentCapability } from './assert-student-capability'
import { assertTeachingCapability } from './assert-teaching-capability'
import { ALL_HOMEROOM_CAPABILITIES } from './homeroom-capability'
import { ALL_TEACHING_CAPABILITIES } from './teaching-capability'

export type CapabilityActorKind = InteractiveActorMetadata['kind']

interface CapabilityTargetInput {
  studentId?: string
  classGroupId?: string
  classSubjectId?: string
}

/**
 * Relationship-native capability gate entry point.
 * Staff continues to use authorize(Permission).
 */
export function assertCapability(
  actor: InteractiveActorMetadata,
  capability: string,
  target?: CapabilityTargetInput,
): void {
  if (!isInteractiveActor(actor)) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  switch (actor.kind) {
    case 'staff':
      throw new AuthorizationError(
        AuthorizationErrorCode.Forbidden,
        'Staff capabilities must use authorize(Permission)',
      )
    case 'teacher':
      if ((ALL_TEACHING_CAPABILITIES as readonly string[]).includes(capability)) {
        assertTeachingCapability(actor, capability as never, normalizeTeachingTarget(target))
        return
      }
      if ((ALL_HOMEROOM_CAPABILITIES as readonly string[]).includes(capability)) {
        assertHomeroomCapability(actor, capability as never, normalizeHomeroomTarget(target))
        return
      }
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    case 'guardian':
      assertGuardianCapability(actor, capability as never, normalizeGuardianTarget(target))
      return
    case 'student':
      assertStudentCapability(actor, capability as never, normalizeStudentTarget(target))
  }
}

export function capabilityTargetFromAuthorizationScope(
  scope?: Pick<AuthorizationRequest, 'scopeType' | 'scopeEntityId'>,
): GuardianCapabilityTarget | StudentCapabilityTarget | undefined {
  if (!scope?.scopeType || !scope.scopeEntityId) {
    return undefined
  }

  if (scope.scopeType === 'student') {
    return { studentId: scope.scopeEntityId }
  }

  if (scope.scopeType === 'class_group') {
    return { classGroupId: scope.scopeEntityId }
  }

  return undefined
}

export function teachingTargetFromAuthorizationScope(
  scope?: Pick<AuthorizationRequest, 'scopeType' | 'scopeEntityId'>,
): TeachingCapabilityTarget | undefined {
  if (!scope?.scopeType || !scope.scopeEntityId || scope.scopeType !== 'class_subject') {
    return undefined
  }

  const classSubjectId = scope.scopeEntityId.includes(':')
    ? scope.scopeEntityId.split(':').at(-1)
    : scope.scopeEntityId

  return classSubjectId ? { classSubjectId } : undefined
}

export function homeroomTargetFromAuthorizationScope(
  scope?: Pick<AuthorizationRequest, 'scopeType' | 'scopeEntityId'>,
): HomeroomCapabilityTarget | undefined {
  if (!scope?.scopeType || !scope.scopeEntityId) {
    return undefined
  }

  if (scope.scopeType === 'class_group') {
    return { classGroupId: scope.scopeEntityId }
  }

  if (scope.scopeType === 'class_subject') {
    const classGroupId = scope.scopeEntityId.includes(':')
      ? scope.scopeEntityId.split(':')[0]
      : undefined
    return classGroupId ? { classGroupId } : undefined
  }

  return undefined
}

function normalizeGuardianTarget(
  target?: CapabilityTargetInput,
): GuardianCapabilityTarget | undefined {
  if (!target) {
    return undefined
  }

  return {
    ...(target.studentId ? { studentId: target.studentId } : {}),
    ...(target.classGroupId ? { classGroupId: target.classGroupId } : {}),
  }
}

function normalizeStudentTarget(
  target?: CapabilityTargetInput,
): StudentCapabilityTarget | undefined {
  if (!target) {
    return undefined
  }

  return {
    ...(target.studentId ? { studentId: target.studentId } : {}),
    ...(target.classGroupId ? { classGroupId: target.classGroupId } : {}),
  }
}

function normalizeTeachingTarget(
  target?: CapabilityTargetInput,
): TeachingCapabilityTarget | undefined {
  if (!target?.classSubjectId) {
    return undefined
  }
  return { classSubjectId: target.classSubjectId }
}

function normalizeHomeroomTarget(
  target?: CapabilityTargetInput,
): HomeroomCapabilityTarget | undefined {
  if (!target?.classGroupId) {
    return undefined
  }
  return { classGroupId: target.classGroupId }
}
