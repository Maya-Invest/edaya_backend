import type { ClassSubject } from '../../../entities/academics/class-subject'
import type { SchoolRepositories } from '../../../ports'
import type { EntityConfigFactory } from '../../../shared'
import { denyResourceAccess, Permission } from '../../../authorization'
import { authorizeClassGroupLinked, authorizeClassGroupLinkedDelete, classGroupLinkedTenant, config, noopReadAccess, permissionAction, read, write } from '../../../shared'

export const classSubjectConfig: EntityConfigFactory<ClassSubject> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.classSubjects,
    tenant: classGroupLinkedTenant('classGroupId'),
    read: read(permissionAction(policy, Permission.QUERY_CLASS_CURRICULUM_READ), noopReadAccess),
    write: write(permissionAction(policy, Permission.ACADEMIC_PROGRAM_UPDATE), authorizeClassGroupLinked(policy, 'classGroupId'), authorizeClassGroupLinkedDelete(policy)),
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
