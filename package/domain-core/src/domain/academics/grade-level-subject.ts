import type { SchoolRepositories } from '../../ports'
import type { EntityConfigFactory } from '../../application/entities/entity-config'
import { z } from 'zod'
import { denyResourceAccess, Permission } from '../../capabilities/authorization'
import { config, indirectTenant, noopDeleteAccess, noopReadAccess, noopSaveAccess, permissionAction, read, write } from '../../application/entities/entity-config'
import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'
import { parseDomain, zodDate } from '../shared/utils'

export const gradeLevelSubjectSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  gradeLevelId: z.string().trim().min(1, 'gradeLevelId must not be blank'),
  academicYearId: z.string().trim().min(1, 'academicYearId must not be blank'),
  subjectId: z.string().trim().min(1, 'subjectId must not be blank'),
  coefficient: z.number().positive('coefficient must be a finite, strictly positive number').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

export type GradeLevelSubjectData = z.infer<typeof gradeLevelSubjectSchema>
export type GradeLevelSubjectInput = z.input<typeof gradeLevelSubjectSchema>

export const gradeLevelSubjectCreateSchema = gradeLevelSubjectSchema.omit({ createdAt: true })
export const gradeLevelSubjectUpdateSchema = gradeLevelSubjectSchema.partial().required({ id: true })

/**
 * Represents a subject allocated to a grade level for an academic year.
 * All classes in that grade inherit mirrored ClassSubject rows via sync.
 */
export class GradeLevelSubject {
  readonly data: GradeLevelSubjectData

  constructor(args: GradeLevelSubjectInput) {
    this.data = parseDomain(gradeLevelSubjectSchema, args)
  }

  get id() { return this.data.id }
  get gradeLevelId() { return this.data.gradeLevelId }
  get academicYearId() { return this.data.academicYearId }
  get subjectId() { return this.data.subjectId }
  get coefficient() { return this.data.coefficient ?? undefined }
  get createdAt() { return this.data.createdAt }
}

export const gradeLevelSubjectConfig: EntityConfigFactory<GradeLevelSubject> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.gradeLevelSubjects,
    tenant: gradeLevelSubjectTenant(),
    read: read(permissionAction(Permission.QUERY_CLASS_CURRICULUM_READ), noopReadAccess),
    write: write(permissionAction(Permission.ACADEMIC_PROGRAM_UPDATE), noopSaveAccess, noopDeleteAccess),
    gates: {
      preSave: validateGradeLevelSubjectSave,
      preDelete: validateGradeLevelSubjectDelete,
    },
    atomicExecution,
  })

function gradeLevelSubjectTenant() {
  return indirectTenant(async (entity: GradeLevelSubject, repositories: SchoolRepositories) => {
    const gradeLevel = await repositories.gradeLevels.findById(entity.gradeLevelId)
    return gradeLevel?.schoolId
  })
}

async function validateGradeLevelSubjectSave(
  gradeLevelSubject: GradeLevelSubject,
  existing: GradeLevelSubject | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const [gradeLevel, academicYear, subject] = await Promise.all([
    repositories.gradeLevels.findById(gradeLevelSubject.gradeLevelId),
    repositories.academicYears.findById(gradeLevelSubject.academicYearId),
    repositories.subjects.findById(gradeLevelSubject.subjectId),
  ])
  if (!gradeLevel || !academicYear || !subject || academicYear.schoolId !== gradeLevel.schoolId || subject.schoolId !== gradeLevel.schoolId) {
    denyResourceAccess()
  }
  if (existing && (existing.gradeLevelId !== gradeLevelSubject.gradeLevelId || existing.academicYearId !== gradeLevelSubject.academicYearId || existing.subjectId !== gradeLevelSubject.subjectId)) {
    throw new BusinessRuleViolationError(
      'GRADE_LEVEL_SUBJECT_IDENTITY_IMMUTABLE',
      'gradeLevelId, academicYearId and subjectId cannot be changed on an existing grade level subject',
    )
  }
  const duplicate = await repositories.gradeLevelSubjects.findOne({
    gradeLevelId: gradeLevelSubject.gradeLevelId,
    academicYearId: gradeLevelSubject.academicYearId,
    subjectId: gradeLevelSubject.subjectId,
  })
  if (duplicate && duplicate.id !== gradeLevelSubject.id) {
    throw new BusinessRuleViolationError(
      'GRADE_LEVEL_SUBJECT_ALREADY_EXISTS',
      `Subject ${gradeLevelSubject.subjectId} is already allocated to grade level ${gradeLevelSubject.gradeLevelId}`,
    )
  }
}

async function validateGradeLevelSubjectDelete(
  gradeLevelSubject: GradeLevelSubject,
  repositories: SchoolRepositories,
): Promise<void> {
  const classSubjects = await repositories.classSubjects.list({ gradeLevelSubjectId: gradeLevelSubject.id })
  for (const classSubject of classSubjects) {
    const [assessments, sessions, staffAssignments] = await Promise.all([
      repositories.assessments.list({ classSubjectId: classSubject.id }),
      repositories.sessions.list({ classSubjectId: classSubject.id }),
      repositories.staffAssignments.list({ classSubjectId: classSubject.id }),
    ])
    if (assessments.length > 0 || sessions.length > 0 || staffAssignments.length > 0) {
      throw new BusinessRuleViolationError(
        'GRADE_LEVEL_SUBJECT_HAS_DEPENDENCIES',
        `Cannot remove grade level subject ${gradeLevelSubject.id}: dependent class records still exist`,
      )
    }
  }
}
