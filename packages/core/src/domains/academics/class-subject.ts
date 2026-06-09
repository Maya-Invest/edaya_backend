import type { SchoolRepositories } from '../../ports'
import type { EntityConfigFactory } from '../../shared'
import { denyResourceAccess, Permission } from '../../authorization'
import { authorizeClassGroupLinked, authorizeClassGroupLinkedDelete, classGroupLinkedTenant, config, noopReadAccess, permissionAction, read, write } from '../../shared'
import { requireNonBlank, requireNonNegativeNumber, requirePositiveNumber } from '../utils'

export interface ClassSubjectArgs {
  id: string
  classGroupId: string
  subjectId: string
  coefficient?: number | null
  completedPercentage?: number | null
  createdAt?: Date
}

/**
 * Represents a concrete subject offering inside a classGroup for an academic year.
 * This is the teachable unit used by assessments, attendance planning, and staff assignment.
 */
export class ClassSubject {
  readonly id: string
  readonly classGroupId: string
  readonly subjectId: string
  readonly coefficient?: number
  readonly createdAt: Date
  readonly completedPercentage: number

  constructor({
    id,
    classGroupId,
    subjectId,
    coefficient,
    createdAt,
    completedPercentage,
  }: ClassSubjectArgs) {
    this.id = requireNonBlank(id, 'id')
    this.classGroupId = requireNonBlank(classGroupId, 'classGroupId')
    this.subjectId = requireNonBlank(subjectId, 'subjectId')
    if (coefficient != null) {
      this.coefficient = requirePositiveNumber(coefficient, 'coefficient')
    }
    this.createdAt = createdAt ?? new Date()
    this.completedPercentage = requireNonNegativeNumber(completedPercentage ?? 0, 'completedPercentage')
    if (this.completedPercentage > 100) {
      throw new Error('completedPercentage must be between 0 and 100')
    }
  }
}

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
