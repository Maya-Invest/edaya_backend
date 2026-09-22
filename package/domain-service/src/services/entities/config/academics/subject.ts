import type { Subject } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'
import { requireSubjectCategory } from '../../../../capabilities/academics/ensure-default-subject-categories'
import { config } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

export const subjectConfig: EntityConfigFactory<Subject> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.subjects,
    tenant: directSchoolTenant(),
    resource: 'subjects',
    gates: {
      preSave: validateSubjectSave,
    },
    atomicExecution,
  })

async function validateSubjectSave(
  subject: Subject,
  _existing: Subject | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  await requireSubjectCategory(repositories, subject.schoolId, subject.categoryId)
}
