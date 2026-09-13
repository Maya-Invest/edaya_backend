import type { SubjectMatter } from '@edaya/core'

import type { EntityConfigFactory, EntityTenantResolver } from '../../entity-config'

import { config } from '../../entity-config'
import { indirectTenant } from '../../entity-config/tenant'

// Extracted from domain/academics/subject-matter.ts (PR3)
export const subjectMatterConfig: EntityConfigFactory<SubjectMatter> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.subjectMatters,
    tenant: subjectMatterTenant(),
    resource: 'subjectMatters',

    atomicExecution,
  })

function subjectMatterTenant(): EntityTenantResolver<SubjectMatter> {
  return indirectTenant(async (entity, repositories) => {
    const subject = await repositories.subjects.findById(entity.subjectId)
    return subject?.schoolId
  })
}
