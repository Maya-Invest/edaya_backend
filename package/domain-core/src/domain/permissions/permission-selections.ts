import { z } from 'zod'
import { grantScopeSchema, validatePermissionScopes } from './grant-scope'
import { Permission } from './permission'
import { permissionScope } from './permission-scopes'

export const permissionScopeSelectionsSchema = z.array(grantScopeSchema).default([]).superRefine((scopes, ctx) => {
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

/** Apply the existing action validator to each selection; never translate between grains. */
export function scopesForPermission(permission: Permission, selections: readonly z.infer<typeof grantScopeSchema>[]) {
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
    const grain = permissionScope(permission)
    if (grain === 'platform')
      return []
    const scope = grain ? { kind: 'all' as const, grain } : { kind: 'school' as const }
    return [[JSON.stringify(scope), scope] as const]
  })).values()]
}
