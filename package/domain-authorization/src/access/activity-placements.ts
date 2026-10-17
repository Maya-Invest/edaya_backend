import type { ResourceAccessScope } from '@edaya/core'
import type { AccessPolicies } from './access-policies'
import { AccessFacts } from './facts'

/** Editing a shared definition affects every placement, not just one visible class. */
export async function assertActivityPlacements(access: AccessPolicies, scope: ResourceAccessScope, activityIds: readonly string[]) {
  const facts = new AccessFacts(access.actor, access.repositories)
  for (const activityId of activityIds) {
    for (const resource of ['classActivityEnrollments', 'activitySessions'] as const) {
      const rows = await facts.list(resource, { activityId })
      for (const row of rows)
        await access.repositories[resource].forAccess({ ...scope, resource }).assertAccess(row as never)
    }
  }
}
