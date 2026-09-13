import type { CoreEntityKey, CoreEntityMap } from '@edaya/core'
import type { AccessPolicies, ActionSelection } from './access-policies'
import { AccessFacts } from './facts'

/** Shared curriculum edits affect every class using that catalog placement. */
export async function assertCurriculumPlacements(access: AccessPolicies, action: ActionSelection, resource: CoreEntityKey, records: readonly CoreEntityMap[CoreEntityKey][]): Promise<void> {
  if (!['subjects', 'subjectMatters', 'gradeLevelSubjects', 'gradeLevelSubjectMatters'].includes(resource))
    return
  const facts = new AccessFacts(access.actor, access.repositories)
  const classIds = new Set<string>()
  for (const record of records) {
    if (resource === 'gradeLevelSubjects' || resource === 'gradeLevelSubjectMatters') {
      const placement = resource === 'gradeLevelSubjects'
        ? record as CoreEntityMap['gradeLevelSubjects']
        : await facts.one('gradeLevelSubjects', (record as CoreEntityMap['gradeLevelSubjectMatters']).gradeLevelSubjectId)
      const classes = await facts.list('classGroups', { gradeLevelId: placement.gradeLevelId, academicYearId: placement.academicYearId })
      for (const group of classes)
        classIds.add(group.id)
    }
    else {
      const subjectId = resource === 'subjects' ? record.id : (record as CoreEntityMap['subjectMatters']).subjectId
      const subjects = await facts.list('classSubjects', { subjectId })
      for (const subject of subjects)
        classIds.add(subject.classGroupId)
      const placements = await facts.list('gradeLevelSubjects', { subjectId })
      for (const placement of placements) {
        const classes = await facts.list('classGroups', { gradeLevelId: placement.gradeLevelId, academicYearId: placement.academicYearId })
        for (const group of classes)
          classIds.add(group.id)
      }
    }
  }
  if (classIds.size)
    await access.assertResources(action, 'classGroups', [...classIds])
}
