import type { ClassSubject } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'
import { AcademicsOperations, denyResourceAccess } from '@edaya/authorization'
import { BusinessRuleViolationError } from '@edaya/core'
import { authorizeClassGroupLinked, authorizeClassGroupLinkedDelete, config, noopReadAccess, operationModule, read, write } from '../../entity-config'
import { classGroupLinkedTenant } from '../../entity-config/tenant'

// Extracted from domain/academics/class-subject.ts (PR3)
export const classSubjectConfig: EntityConfigFactory<ClassSubject> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.classSubjects,
    tenant: classGroupLinkedTenant('classGroupId'),
    read: read(operationModule(AcademicsOperations.programRead), noopReadAccess),
    write: write(operationModule(AcademicsOperations.programUpdate), authorizeClassGroupLinked(policy, 'classGroupId'), authorizeClassGroupLinkedDelete(policy)),
    gates: {
      preSave: validateClassSubjectSave,
    },
    atomicExecution,
  })

function isProgressOnlyClassSubjectUpdate(existing: ClassSubject, classSubject: ClassSubject): boolean {
  return existing.classGroupId === classSubject.classGroupId
    && existing.subjectId === classSubject.subjectId
    && existing.gradeLevelSubjectId === classSubject.gradeLevelSubjectId
    && existing.coefficient === classSubject.coefficient
    && existing.periodsPerWeek === classSubject.periodsPerWeek
    && existing.minPeriodSpan === classSubject.minPeriodSpan
    && existing.maxPeriodSpan === classSubject.maxPeriodSpan
    && existing.isOffered === classSubject.isOffered
    && classSubject.completedPercentage !== existing.completedPercentage
}

function isOfferedOnlyClassSubjectUpdate(existing: ClassSubject, classSubject: ClassSubject): boolean {
  return existing.classGroupId === classSubject.classGroupId
    && existing.subjectId === classSubject.subjectId
    && existing.gradeLevelSubjectId === classSubject.gradeLevelSubjectId
    && existing.coefficient === classSubject.coefficient
    && existing.periodsPerWeek === classSubject.periodsPerWeek
    && existing.minPeriodSpan === classSubject.minPeriodSpan
    && existing.maxPeriodSpan === classSubject.maxPeriodSpan
    && existing.completedPercentage === classSubject.completedPercentage
    && classSubject.isOffered !== existing.isOffered
}

function isTimetableOnlyClassSubjectUpdate(existing: ClassSubject, classSubject: ClassSubject): boolean {
  return existing.classGroupId === classSubject.classGroupId
    && existing.subjectId === classSubject.subjectId
    && existing.gradeLevelSubjectId === classSubject.gradeLevelSubjectId
    && existing.coefficient === classSubject.coefficient
    && existing.completedPercentage === classSubject.completedPercentage
    && existing.isOffered === classSubject.isOffered
    && (
      classSubject.periodsPerWeek !== existing.periodsPerWeek
      || classSubject.minPeriodSpan !== existing.minPeriodSpan
      || classSubject.maxPeriodSpan !== existing.maxPeriodSpan
    )
}

function isCustomClassSubject(classSubject: ClassSubject): boolean {
  return !classSubject.gradeLevelSubjectId
}

async function validateClassSubjectSave(
  classSubject: ClassSubject,
  existing: ClassSubject | undefined,
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
  if (existing && isProgressOnlyClassSubjectUpdate(existing, classSubject)) {
    return
  }
  if (existing && isOfferedOnlyClassSubjectUpdate(existing, classSubject)) {
    return
  }
  if (existing && isTimetableOnlyClassSubjectUpdate(existing, classSubject)) {
    return
  }
  if (!classSubject.gradeLevelSubjectId) {
    if (existing && !isCustomClassSubject(existing)) {
      throw new BusinessRuleViolationError(
        'CLASS_SUBJECT_INHERITED_FROM_GRADE_LEVEL',
        'Inherited class subjects cannot be converted to custom subjects',
      )
    }
    const duplicate = await repositories.classSubjects.findOne({
      classGroupId: classSubject.classGroupId,
      subjectId: classSubject.subjectId,
    })
    if (duplicate && duplicate.id !== classSubject.id) {
      throw new BusinessRuleViolationError(
        'CLASS_SUBJECT_ALREADY_EXISTS',
        `Subject ${classSubject.subjectId} is already offered in class group ${classSubject.classGroupId}`,
      )
    }
    return
  }
  if (!existing) {
    throw new BusinessRuleViolationError(
      'CLASS_SUBJECT_MANAGED_AT_GRADE_LEVEL',
      'Class subjects are inherited from grade level allocation and cannot be created directly',
    )
  }
  throw new BusinessRuleViolationError(
    'CLASS_SUBJECT_MANAGED_AT_GRADE_LEVEL',
    'Inherited class subjects can only be updated through grade level sync or setClassSubjectOffered',
  )
}
