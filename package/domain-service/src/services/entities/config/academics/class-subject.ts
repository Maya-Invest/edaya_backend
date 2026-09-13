import type { ClassSubject } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'
import { denyResourceAccess } from '@edaya/authorization'
import { BusinessRuleViolationError } from '@edaya/core'
import { config } from '../../entity-config'
import { classGroupLinkedTenant } from '../../entity-config/tenant'

// Extracted from domain/academics/class-subject.ts (PR3)
export const classSubjectConfig: EntityConfigFactory<ClassSubject> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.classSubjects,
    tenant: classGroupLinkedTenant('classGroupId'),
    resource: 'classSubjects',

    gates: {
      preSave: validateClassSubjectSave,
      preDelete: validateClassSubjectDelete,
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

/** Custom allocations may be removed only while unused; inherited curriculum is command-owned. */
export async function validateClassSubjectDelete(classSubject: ClassSubject, repositories: SchoolRepositories): Promise<void> {
  if (classSubject.gradeLevelSubjectId) {
    throw new BusinessRuleViolationError('CLASS_SUBJECT_MANAGED_AT_GRADE_LEVEL', 'Remove inherited subjects through grade-level curriculum management')
  }
  await assertClassSubjectUnused(classSubject, repositories)
}

/** Also applies when a curriculum command removes inherited allocations. */
export async function assertClassSubjectUnused(classSubject: ClassSubject, repositories: SchoolRepositories): Promise<void> {
  const filter = { classSubjectId: classSubject.id, $limit: 1 }
  const dependencies = await Promise.all([
    repositories.assessments.list(filter),
    repositories.schedules.list(filter),
    repositories.lessonSessions.list(filter),
    repositories.staffAssignments.list(filter),
    repositories.teacherAssignments.list(filter),
    repositories.classSubjectMatters.list(filter),
  ])
  if (dependencies.some(rows => rows.length > 0)) {
    throw new BusinessRuleViolationError('CLASS_SUBJECT_HAS_DEPENDENCIES', 'A class subject with teaching, assessment or curriculum records cannot be deleted')
  }
}
