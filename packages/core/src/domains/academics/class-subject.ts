import type { SchoolRepositories } from '../../ports'
import type { EntityConfigFactory } from '../../shared'
import { z } from 'zod'
import { denyResourceAccess, Permission } from '../../authorization'
import { authorizeClassGroupLinked, authorizeClassGroupLinkedDelete, classGroupLinkedTenant, config, noopReadAccess, permissionAction, read, write } from '../../shared'
import { parseDomain, zodDate } from '../utils'

export const classSubjectSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  classGroupId: z.string().trim().min(1, 'classGroupId must not be blank'),
  subjectId: z.string().trim().min(1, 'subjectId must not be blank'),
  coefficient: z.number().positive('coefficient must be a finite, strictly positive number').nullable().optional().transform(v => v === null ? undefined : v),
  completedPercentage: z.preprocess(
    val => val === null ? undefined : val,
    z.number().min(0, 'completedPercentage must be a finite, non-negative number').max(100, 'completedPercentage must be between 0 and 100').default(0),
  ),
  createdAt: zodDate().default(() => new Date()),
})

export type ClassSubjectData = z.infer<typeof classSubjectSchema>
export type ClassSubjectInput = z.input<typeof classSubjectSchema>

export const classSubjectCreateSchema = classSubjectSchema.omit({ createdAt: true })
export const classSubjectUpdateSchema = classSubjectSchema.partial().required({ id: true })

/**
 * Represents a concrete subject offering inside a classGroup for an academic year.
 * This is the teachable unit used by assessments, attendance planning, and staff assignment.
 */
export class ClassSubject {
  readonly data: ClassSubjectData

  constructor(args: ClassSubjectInput) {
    this.data = parseDomain(classSubjectSchema, args)
  }

  get id() { return this.data.id }
  get classGroupId() { return this.data.classGroupId }
  get subjectId() { return this.data.subjectId }
  get coefficient() { return this.data.coefficient ?? undefined }
  get createdAt() { return this.data.createdAt }
  get completedPercentage() { return this.data.completedPercentage }
}

export const classSubjectConfig: EntityConfigFactory<ClassSubject> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.classSubjects,
    tenant: classGroupLinkedTenant('classGroupId'),
    read: read(permissionAction(Permission.QUERY_CLASS_CURRICULUM_READ), noopReadAccess),
    write: write(permissionAction(Permission.ACADEMIC_PROGRAM_UPDATE), authorizeClassGroupLinked(policy, 'classGroupId'), authorizeClassGroupLinkedDelete(policy)),
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
