import type { grantScopeSchema } from './grant-scope'
import { z } from 'zod'
import { userScopeSelectionSchema, validatePermissionScopes } from './grant-scope'
import { Permission } from './permission'
import { corePermissionDefinition } from './permission-catalog'

export const permissionScopeSelectionsSchema = z.array(userScopeSelectionSchema).default([]).superRefine((scopes, ctx) => {
  const keys = scopes.map(scope => JSON.stringify(scope))
  if (new Set(keys).size !== keys.length)
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Scope selections must be unique' })
  if (scopes.some(scope => scope.kind === 'activity' && !scope.activityId && !scope.classGroupId))
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Activity scope requires an activity or class' })
})

export const permissionResolutionWarningSchema = z.object({
  permission: z.nativeEnum(Permission),
  reason: z.enum(['missing_scope', 'invalid_scope', 'shadowed']),
  ownerProfileId: z.string().optional(),
})
export type PermissionResolutionWarning = z.infer<typeof permissionResolutionWarningSchema>

/** Unscoped assignments resolve automatically; selected resources never translate between grains. */
export function scopesForPermission(permission: Permission, selections: readonly z.infer<typeof grantScopeSchema>[]) {
  const definition = corePermissionDefinition(permission)
  if (!definition.staffAssignable)
    return []
  if (definition.scopePolicy.mode === 'none')
    return [{ kind: 'school' as const }]
  const compatible = selections.filter((scope) => {
    try {
      validatePermissionScopes(permission, [scope])
      return true
    }
    catch {
      return false
    }
  })
  const unique = [...new Map(compatible.map(scope => [JSON.stringify(scope), scope])).values()]
  if (unique.some(scope => scope.kind === 'school'))
    return [{ kind: 'school' as const }]
  return unique.filter(scope => scope.kind === 'all'
    || !unique.some(candidate => candidate.kind === 'all' && candidate.grain === scope.kind))
}

/** Invitation presets explicitly select broad scopes; ordinary assignment forms do not. */
export function presetScopeSelections(permissions: readonly Permission[]) {
  return [...new Map(permissions.flatMap((permission) => {
    const policy = corePermissionDefinition(permission).scopePolicy
    if (policy.mode !== 'resources')
      return []
    return policy.allowedKinds.map((grain) => {
      const scope = { kind: 'all' as const, grain }
      return [JSON.stringify(scope), scope] as const
    })
  })).values()]
}
