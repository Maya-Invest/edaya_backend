import type { AuthorityScope, Permission } from '@edaya/core'
import type { ActorMetadata } from '../model/actor'
import type { AuthorizationRepositories } from '../ports/authorization-repositories'
import { grantScopeSchema, Permission as P } from '@edaya/core'
import { AuthorizationError } from '../model/errors'
import { assertHumanOnlyPermission, assertPermissionAssurance } from '../permissions/permission-assurance'
import { AccessFacts, denied } from './facts'
import { SCHOOL_OWNER_ACTIONS } from './owner-authority'
import { familyPolicy, teacherPolicy } from './portal-policies'

export interface ActionGrantDisplay {
  permission: Permission
  scopes: AuthorityScope[]
  academicYearId?: string
  startsAt?: Date
  endsAt?: Date
  source: 'manual' | 'assignment' | 'relationship' | 'owner'
}

/** Display projection only. Production enforcement always reads facts through policies. */
export async function describeActionGrants(actor: ActorMetadata, repositories: AuthorizationRepositories): Promise<ActionGrantDisplay[]> {
  if (actor.kind === 'system' || actor.kind === 'platform' || actor.kind === 's2s')
    denied('System actors cannot introspect grants')
  const facts = new AccessFacts(actor, repositories)
  await facts.validateActor()
  const owner = await facts.owner()
  if (actor.kind === 'staff') {
    const grants: ActionGrantDisplay[] = owner
      ? SCHOOL_OWNER_ACTIONS.map(permission => ({ permission, scopes: [{ kind: 'school' }], source: 'owner' }))
      : (await facts.staffGrants()).map(grant => ({ ...grant, scopes: [...grant.scopes] }))
    if (!owner && actor.accountKind !== 'service')
      grants.push({ permission: P.WORKSPACE_ACCESS, scopes: [{ kind: 'school' }], source: 'relationship' })
    return grants.filter((grant) => {
      try {
        assertHumanOnlyPermission(actor.accountKind, grant.permission, owner)
        assertPermissionAssurance(actor.assuranceLevel, grant.permission, actor.accountKind, owner)
        return true
      }
      catch (error) {
        if (error instanceof AuthorizationError)
          return false
        throw error
      }
    })
  }
  const grants: ActionGrantDisplay[] = []
  for (const permission of Object.values(P)) {
    const policy = actor.kind === 'teacher' ? teacherPolicy : familyPolicy
    const clauses = [
      ...await policy(facts, permission, undefined, 'read'),
      ...await policy(facts, permission, undefined, 'write', 'create'),
      ...await policy(facts, permission, undefined, 'write', 'update'),
    ]
    const scopes = clauses.flatMap((clause) => {
      const parsed = grantScopeSchema.safeParse(clause.target)
      return parsed.success ? [parsed.data] : []
    })
    const unique = [...new Map(scopes.map(scope => [JSON.stringify(scope), scope])).values()]
    if (unique.length)
      grants.push({ permission, scopes: unique, academicYearId: await facts.academicYear(), source: 'relationship' })
  }
  return grants
}
