import type { ClassSubject } from '../../../entities/academics/class-subject'
import type { SchoolRepositories } from '../../../ports'
import type { EntityConfigFactory } from '../../../shared'
import { denyResourceAccess } from '../../../authorization'
import { action, authorizeClassGroupLinked, authorizeClassGroupLinkedDelete, classGroupLinkedTenant, config, noopReadAccess, read, write } from '../../../shared'

export const classSubjectConfig: EntityConfigFactory<ClassSubject> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.classSubjects,
    tenant: classGroupLinkedTenant('classGroupId'),
    read: read(action(policy, 'queries.read_class_curriculum'), noopReadAccess),
    write: write(action(policy, 'academics.manage_curriculum'), authorizeClassGroupLinked(policy, 'classGroupId'), authorizeClassGroupLinkedDelete(policy)),
    gates: {
      preSave: validateClassSubjectSave,
    },
    atomicExecution,
  })

async function validateClassSubjectSave(
  classSubject: ClassSubject,
  _existing: ClassSubject | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  if (!repositories.classGroups || !repositories.subjects) {
    return
  }
  const [classGroup, subject] = await Promise.all([
    repositories.classGroups.findById(classSubject.classGroupId),
    repositories.subjects.findById(classSubject.subjectId),
  ])
  if (!classGroup || !subject || subject.schoolId !== classGroup.schoolId) {
    denyResourceAccess()
  }
}
