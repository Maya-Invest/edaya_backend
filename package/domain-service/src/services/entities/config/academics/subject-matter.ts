import type { SubjectMatter } from '@edaya/core'

import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory, EntityTenantResolver } from '../../entity-config'

import { config } from '../../entity-config'
import { indirectTenant } from '../../entity-config/tenant'
import { validateClassSubjectMatterDelete } from './class-subject-matter'

// Extracted from domain/academics/subject-matter.ts (PR3)
export const subjectMatterConfig: EntityConfigFactory<SubjectMatter> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.subjectMatters,
    tenant: subjectMatterTenant(),
    resource: 'subjectMatters',
    writeLockGroup: 'academic-state',
    gates: { preDelete: removeUnusedMatterLinks },

    atomicExecution,
  })

function subjectMatterTenant(): EntityTenantResolver<SubjectMatter> {
  return indirectTenant(async (entity, repositories) => {
    const subject = await repositories.subjects.findById(entity.subjectId)
    return subject?.schoolId
  })
}

/** Delete mirrors before their anchor, in the already authorized parent transaction. */
async function removeUnusedMatterLinks(matter: SubjectMatter, repositories: SchoolRepositories): Promise<void> {
  const classMatters = await repositories.classSubjectMatters.list({ subjectMatterId: matter.id })
  const gradeMatters = await repositories.gradeLevelSubjectMatters.list({ subjectMatterId: matter.id })
  for (const mirrored of classMatters)
    await validateClassSubjectMatterDelete(mirrored, repositories)
  await repositories.classSubjectMatters.batchDelete(classMatters.map(entry => entry.id))
  await repositories.gradeLevelSubjectMatters.batchDelete(gradeMatters.map(entry => entry.id))
}
