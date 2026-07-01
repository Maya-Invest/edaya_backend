import type { EntityConfigFactory } from '../../application/entities/entity-config'
import type { SchoolRepositories } from '../../ports'
import { z } from 'zod'
import { config, indirectTenant, noopDeleteAccess, noopReadAccess, noopSaveAccess, permissionAction, read, write } from '../../application/entities/entity-config'
import { denyResourceAccess, Permission } from '../../capabilities/authorization'
import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'
import { parseDomain, zodDate } from '../shared/utils'

export const gradeLevelSubjectMatterSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  gradeLevelSubjectId: z.string().trim().min(1, 'gradeLevelSubjectId must not be blank'),
  subjectMatterId: z.string().trim().min(1, 'subjectMatterId must not be blank'),
  createdAt: zodDate().default(() => new Date()),
})

export type GradeLevelSubjectMatterData = z.infer<typeof gradeLevelSubjectMatterSchema>
export type GradeLevelSubjectMatterInput = z.input<typeof gradeLevelSubjectMatterSchema>

export const gradeLevelSubjectMatterCreateSchema = gradeLevelSubjectMatterSchema.omit({ createdAt: true })
export const gradeLevelSubjectMatterUpdateSchema = gradeLevelSubjectMatterSchema.partial().required({ id: true })

/**
 * Links a programme chapter to a grade-level subject offering.
 * Mirrored onto each class ClassSubjectMatter during sync.
 */
export class GradeLevelSubjectMatter {
  readonly data: GradeLevelSubjectMatterData

  constructor(args: GradeLevelSubjectMatterInput) {
    this.data = parseDomain(gradeLevelSubjectMatterSchema, args)
  }

  get id() { return this.data.id }
  get gradeLevelSubjectId() { return this.data.gradeLevelSubjectId }
  get subjectMatterId() { return this.data.subjectMatterId }
  get createdAt() { return this.data.createdAt }
}

export const gradeLevelSubjectMatterConfig: EntityConfigFactory<GradeLevelSubjectMatter> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.gradeLevelSubjectMatters,
    tenant: gradeLevelSubjectMatterTenant(),
    read: read(permissionAction(Permission.QUERY_CLASS_CURRICULUM_READ), noopReadAccess),
    write: write(permissionAction(Permission.ACADEMIC_PROGRAM_UPDATE), noopSaveAccess, noopDeleteAccess),
    gates: {
      preSave: validateGradeLevelSubjectMatterSave,
    },
    atomicExecution,
  })

function gradeLevelSubjectMatterTenant() {
  return indirectTenant(async (entity: GradeLevelSubjectMatter, repositories: SchoolRepositories) => {
    const gradeLevelSubject = await repositories.gradeLevelSubjects.findById(entity.gradeLevelSubjectId)
    if (!gradeLevelSubject) {
      return undefined
    }
    const gradeLevel = await repositories.gradeLevels.findById(gradeLevelSubject.gradeLevelId)
    return gradeLevel?.schoolId
  })
}

async function validateGradeLevelSubjectMatterSave(
  gradeLevelSubjectMatter: GradeLevelSubjectMatter,
  _existing: GradeLevelSubjectMatter | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const [gradeLevelSubject, subjectMatter] = await Promise.all([
    repositories.gradeLevelSubjects.findById(gradeLevelSubjectMatter.gradeLevelSubjectId),
    repositories.subjectMatters.findById(gradeLevelSubjectMatter.subjectMatterId),
  ])
  if (!gradeLevelSubject || !subjectMatter || subjectMatter.subjectId !== gradeLevelSubject.subjectId) {
    denyResourceAccess()
  }
  const duplicate = await repositories.gradeLevelSubjectMatters.findOne({
    gradeLevelSubjectId: gradeLevelSubjectMatter.gradeLevelSubjectId,
    subjectMatterId: gradeLevelSubjectMatter.subjectMatterId,
  })
  if (duplicate && duplicate.id !== gradeLevelSubjectMatter.id) {
    throw new BusinessRuleViolationError(
      'GRADE_LEVEL_SUBJECT_MATTER_ALREADY_EXISTS',
      `Matter ${gradeLevelSubjectMatter.subjectMatterId} is already linked to grade level subject ${gradeLevelSubjectMatter.gradeLevelSubjectId}`,
    )
  }
}
