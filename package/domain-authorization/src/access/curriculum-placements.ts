import type { CoreEntityKey, CoreEntityMap } from '@edaya/core'
import type { AccessPolicies, ActionSelection } from './access-policies'
import { AccessFacts } from './facts'

/** A shared curriculum mutation must authorize every affected class offering. */
export async function assertCurriculumPlacements(access: AccessPolicies, action: ActionSelection, resource: CoreEntityKey, records: readonly CoreEntityMap[CoreEntityKey][]): Promise<void> {
  if (resource !== 'subjects' && resource !== 'subjectMatters')
    return
  const facts = new AccessFacts(access.actor, access.repositories)
  const ids = new Set<string>()
  for (const record of records) {
    const subjectId = resource === 'subjects' ? record.id : (record as CoreEntityMap['subjectMatters']).subjectId
    for (const offering of await facts.list('classSubjects', { subjectId }))
      ids.add(offering.id)
  }
  if (ids.size)
    await access.assertResources(action, 'classSubjects', [...ids])
}
