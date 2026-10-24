import type { ClassSubject } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'
import { denyResourceAccess } from '@edaya/authorization'
import { BusinessRuleViolationError } from '@edaya/core'
import { offeringParticipationHooks } from '../../../../capabilities/subject-enrollment/mutation-hooks'
import { config } from '../../entity-config'
import { classGroupLinkedTenant } from '../../entity-config/tenant'

// Extracted from domain/academics/class-subject.ts (PR3)
export const classSubjectConfig: EntityConfigFactory<ClassSubject> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.classSubjects,
    tenant: classGroupLinkedTenant('classGroupId'),
    resource: 'classSubjects',
    writeLockGroup: 'academic-state',

    gates: {
      preSave: validateClassSubjectSave,
      preDelete: validateClassSubjectDelete,
    },
    hooks: offeringParticipationHooks,
    atomicExecution,
  })

function isProgressOnlyClassSubjectUpdate(existing: ClassSubject, classSubject: ClassSubject): boolean {
  return existing.classGroupId === classSubject.classGroupId
    && existing.subjectId === classSubject.subjectId
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
    && existing.coefficient === classSubject.coefficient
    && existing.completedPercentage === classSubject.completedPercentage
    && existing.isOffered === classSubject.isOffered
    && (
      classSubject.periodsPerWeek !== existing.periodsPerWeek
      || classSubject.minPeriodSpan !== existing.minPeriodSpan
      || classSubject.maxPeriodSpan !== existing.maxPeriodSpan
    )
}

async function validateClassSubjectSave(classSubject: ClassSubject, existing: ClassSubject | undefined, repositories: SchoolRepositories): Promise<void> {
  if (existing && classSubject.participationRevision !== existing.participationRevision)
    throw new BusinessRuleViolationError('SUBJECT_PARTICIPATION_REVISION_MANAGED', 'Participation revisions are managed by enrollment commands')
  await assertClassSubjectGradingMutable(classSubject, existing, repositories)
  const [group, subject] = await Promise.all([
    repositories.classGroups.findById(classSubject.classGroupId),
    repositories.subjects.findById(classSubject.subjectId),
  ])
  if (!group || !subject || group.schoolId !== subject.schoolId || group.gradeLevelId !== subject.gradeLevelId || group.academicYearId !== subject.academicYearId)
    denyResourceAccess()
  if (existing && existing.classGroupId === classSubject.classGroupId && existing.subjectId === classSubject.subjectId
    && existing.coefficient === classSubject.coefficient && existing.periodsPerWeek === classSubject.periodsPerWeek
    && existing.minPeriodSpan === classSubject.minPeriodSpan && existing.maxPeriodSpan === classSubject.maxPeriodSpan
    && existing.isOffered === classSubject.isOffered && existing.completedPercentage === classSubject.completedPercentage) {
    return
  }
  if (existing && (isProgressOnlyClassSubjectUpdate(existing, classSubject) || isOfferedOnlyClassSubjectUpdate(existing, classSubject) || isTimetableOnlyClassSubjectUpdate(existing, classSubject)))
    return
  throw new BusinessRuleViolationError('CLASS_SUBJECT_MANAGED_BY_SUBJECT', 'Class offerings are managed through subject synchronization')
}

export async function validateClassSubjectDelete(_classSubject: ClassSubject, _repositories: SchoolRepositories): Promise<void> {
  throw new BusinessRuleViolationError('CLASS_SUBJECT_MANAGED_BY_SUBJECT', 'Remove subjects through curriculum management; disable individual class offerings instead')
}

/** Also applies when a curriculum command removes inherited allocations. */
export async function assertClassSubjectUnused(classSubject: ClassSubject, repositories: SchoolRepositories): Promise<void> {
  const filter = { classSubjectId: classSubject.id, $limit: 1 }
  const dependencies = await Promise.all([
    repositories.subjectEnrollments.list(filter),
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

/** Shared by generic writes and curriculum synchronization under the academic-state lock. */
export async function assertClassSubjectGradingMutable(classSubject: ClassSubject, existing: ClassSubject | undefined, repositories: Pick<SchoolRepositories, 'assessments'>): Promise<void> {
  if (existing && (classSubject.subjectId !== existing.subjectId || classSubject.classGroupId !== existing.classGroupId || classSubject.coefficient !== existing.coefficient)) {
    if (await repositories.assessments.count({ classSubjectId: existing.id, marksStatus: { $ne: 'draft' } }))
      throw new BusinessRuleViolationError('ASSESSMENT_MARKS_FROZEN', 'Return affected marks sheets before changing their subject configuration')
  }
}
