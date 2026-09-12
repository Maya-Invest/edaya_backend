import type { GuardianCapability } from '../capabilities/guardian-capability'
import type { HomeroomCapability } from '../capabilities/homeroom-capability'
import type { StudentCapability } from '../capabilities/student-capability'
import type { TeachingCapability } from '../capabilities/teaching-capability'
import type {
  OperationContextKey,
  OperationDefinition,
  OperationRef,
  OperationTargetKey,
  TeacherOperationRule,
} from './types'
import { ALL_GUARDIAN_CAPABILITIES } from '../capabilities/guardian-capability'
import { ALL_HOMEROOM_CAPABILITIES } from '../capabilities/homeroom-capability'
import { ALL_STUDENT_CAPABILITIES } from '../capabilities/student-capability'
import { ALL_TEACHING_CAPABILITIES } from '../capabilities/teaching-capability'

const operationRegistry = new Map<string, OperationRef>()

const TARGET_CONTEXT_KEYS: Record<OperationTargetKey, OperationContextKey | undefined> = {
  student: 'studentId',
  classGroup: 'classGroupId',
  classSubject: 'classSubjectId',
  none: undefined,
}

function isGuardianCapability(value: string): value is GuardianCapability {
  return (ALL_GUARDIAN_CAPABILITIES as readonly string[]).includes(value)
}

function isStudentCapability(value: string): value is StudentCapability {
  return (ALL_STUDENT_CAPABILITIES as readonly string[]).includes(value)
}

function isTeachingCapability(value: string): value is TeachingCapability {
  return (ALL_TEACHING_CAPABILITIES as readonly string[]).includes(value)
}

function isHomeroomCapability(value: string): value is HomeroomCapability {
  return (ALL_HOMEROOM_CAPABILITIES as readonly string[]).includes(value)
}

function validateTeacherRule(rule: TeacherOperationRule, operationId: string, path: string): void {
  if ('allow' in rule) {
    return
  }
  if ('anyOf' in rule) {
    if (rule.anyOf.length === 0) {
      throw new Error(`Operation ${operationId}: ${path}.anyOf must not be empty`)
    }
    for (const [index, child] of rule.anyOf.entries()) {
      validateTeacherRule(child, operationId, `${path}.anyOf[${index}]`)
    }
    return
  }

  const capability = rule.capability
  if (!isTeachingCapability(capability) && !isHomeroomCapability(capability)) {
    throw new Error(`Operation ${operationId}: ${path} has invalid teacher capability ${capability}`)
  }
}

function collectRequiredContextFromTeacherRule(
  rule: TeacherOperationRule,
  required: Set<OperationContextKey>,
): void {
  if ('allow' in rule) {
    return
  }
  if ('anyOf' in rule) {
    for (const child of rule.anyOf) {
      collectRequiredContextFromTeacherRule(child, required)
    }
    return
  }

  const contextKey = rule.target ? TARGET_CONTEXT_KEYS[rule.target] : undefined
  if (contextKey) {
    required.add(contextKey)
  }
}

function collectRequiredContextFromTarget(
  target: OperationTargetKey | undefined,
  required: Set<OperationContextKey>,
): void {
  const contextKey = target ? TARGET_CONTEXT_KEYS[target] : undefined
  if (contextKey) {
    required.add(contextKey)
  }
}

function validateDefinition(definition: OperationDefinition): void {
  const paths = [
    definition.staff,
    definition.teacher,
    definition.guardian,
    definition.student,
    definition.platform,
  ].filter(path => path !== undefined)

  if (paths.length === 0) {
    throw new Error(`Operation ${definition.id} must define at least one actor path`)
  }

  if (definition.guardian && !isGuardianCapability(definition.guardian.capability)) {
    throw new Error(`Operation ${definition.id}: guardian capability must be a GuardianCapability value`)
  }

  if (definition.student && !isStudentCapability(definition.student.capability)) {
    throw new Error(`Operation ${definition.id}: student capability must be a StudentCapability value`)
  }

  if (definition.teacher) {
    validateTeacherRule(definition.teacher, definition.id, 'teacher')
  }

  if (definition.requiresContext?.length) {
    const inferredRequired = new Set<OperationContextKey>()
    if (definition.guardian) {
      collectRequiredContextFromTarget(definition.guardian.target, inferredRequired)
    }
    if (definition.student) {
      collectRequiredContextFromTarget(definition.student.target, inferredRequired)
    }
    if (definition.teacher) {
      collectRequiredContextFromTeacherRule(definition.teacher, inferredRequired)
    }

    for (const key of inferredRequired) {
      if (!definition.requiresContext.includes(key)) {
        throw new Error(
          `Operation ${definition.id}: requiresContext must include ${key}`,
        )
      }
    }
  }
}

export function defineOperation(definition: OperationDefinition): OperationRef {
  if (operationRegistry.has(definition.id)) {
    throw new Error(`Operation ${definition.id} is already registered`)
  }

  validateDefinition(definition)

  const ref: OperationRef = Object.freeze({
    id: definition.id,
    definition: Object.freeze(definition),
  })
  operationRegistry.set(definition.id, ref)
  return ref
}

export function defineOperationFamily<
  const T extends Record<string, OperationDefinition>,
>(family: T): { readonly [K in keyof T]: OperationRef } {
  const refs = {} as { [K in keyof T]: OperationRef }
  for (const [key, definition] of Object.entries(family) as [keyof T, OperationDefinition][]) {
    refs[key] = defineOperation(definition)
  }
  return Object.freeze(refs)
}

export function getRegisteredOperations(): readonly OperationRef[] {
  return [...operationRegistry.values()]
}

export function resetOperationRegistryForTests(): void {
  operationRegistry.clear()
}
