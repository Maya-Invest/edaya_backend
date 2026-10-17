import type { Permission } from './permission'
import { z } from 'zod'
import { corePermissionDefinition } from './permission-catalog'

const identifier = z.string().trim().min(1)
export const grantGrainSchema = z.enum(['grade_level', 'grade_level_subject', 'class_group', 'class_subject', 'activity', 'student'])

/** A missing subject selects all subjects within the explicitly named class/grade. */
export const userScopeSelectionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('all'), grain: grantGrainSchema }).strict(),
  z.object({ kind: z.literal('grade_level'), gradeLevelId: identifier }).strict(),
  z.object({ kind: z.literal('grade_level_subject'), gradeLevelId: identifier, gradeLevelSubjectId: identifier.optional() }).strict(),
  z.object({ kind: z.literal('class_group'), classGroupId: identifier }).strict(),
  z.object({ kind: z.literal('class_subject'), classGroupId: identifier, classSubjectId: identifier.optional() }).strict(),
  z.object({ kind: z.literal('activity'), activityId: identifier.optional(), classGroupId: identifier.optional() }).strict(),
  z.object({ kind: z.literal('student'), studentId: identifier }).strict(),
])

export type UserScopeSelection = z.infer<typeof userScopeSelectionSchema>
export const grantScopeSchema = z.discriminatedUnion('kind', [z.object({ kind: z.literal('school') }).strict(), ...userScopeSelectionSchema.options])

export type GrantScope = z.infer<typeof grantScopeSchema>

export const grantScopesSchema = z.array(grantScopeSchema).min(1).superRefine((scopes, ctx) => {
  if (scopes.some(scope => scope.kind === 'school') && scopes.length !== 1)
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'School scope must be the only scope' })
  const keys = scopes.map(scope => JSON.stringify(scope))
  if (new Set(keys).size !== keys.length)
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Grant scopes must be unique' })
  if (scopes.some(scope => scope.kind === 'activity' && !scope.activityId && !scope.classGroupId))
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Activity scope requires an activity or class; use an explicit all scope for every activity' })
})

/** Scope validation and resolution share the same exhaustive core catalog. */
export function validatePermissionScopes(permission: Permission, scopes: readonly GrantScope[]): void {
  const parsed = grantScopesSchema.parse(scopes)
  const definition = corePermissionDefinition(permission)
  const policy = definition.scopePolicy
  if (!definition.staffAssignable || policy.mode === 'platform' || policy.mode === 'relationship')
    throw new Error('Platform actions cannot be delegated through staff grants')
  const valid = parsed.every((scope) => {
    if (policy.mode === 'none')
      return scope.kind === 'school'
    if (scope.kind === 'school')
      return false
    return policy.allowedKinds.includes(scope.kind === 'all' ? scope.grain : scope.kind)
  })
  if (!valid)
    throw new Error(`Permission ${permission} requires ${policy.mode === 'none' ? 'school' : policy.allowedKinds.join(' or ')} scope`)
}

/** Structural containment only; relationship containment is checked against repositories. */
export function grantScopeContains(granted: GrantScope, requested: GrantScope): boolean {
  if (granted.kind === 'school')
    return true
  if (granted.kind === 'all')
    return requested.kind === 'all' ? granted.grain === requested.grain : granted.grain === requested.kind
  if (granted.kind !== requested.kind)
    return false
  switch (granted.kind) {
    case 'class_group': return requested.kind === 'class_group' && granted.classGroupId === requested.classGroupId
    case 'class_subject': return requested.kind === 'class_subject' && granted.classGroupId === requested.classGroupId
      && (granted.classSubjectId === undefined || granted.classSubjectId === requested.classSubjectId)
    case 'grade_level': return requested.kind === 'grade_level' && granted.gradeLevelId === requested.gradeLevelId
    case 'grade_level_subject': return requested.kind === 'grade_level_subject' && granted.gradeLevelId === requested.gradeLevelId
      && (granted.gradeLevelSubjectId === undefined || granted.gradeLevelSubjectId === requested.gradeLevelSubjectId)
    case 'activity': return requested.kind === 'activity' && (granted.activityId === undefined || granted.activityId === requested.activityId)
      && (granted.classGroupId === undefined || granted.classGroupId === requested.classGroupId)
    case 'student': return requested.kind === 'student' && granted.studentId === requested.studentId
  }
}

export function grantScopesEquivalent(left: readonly GrantScope[], right: readonly GrantScope[]): boolean {
  if (left.length !== right.length)
    return false
  const keys = (scopes: readonly GrantScope[]) => [...scopes.map(scope => JSON.stringify(scope))].sort()
  const a = keys(left)
  const b = keys(right)
  return a.every((key, index) => key === b[index])
}
