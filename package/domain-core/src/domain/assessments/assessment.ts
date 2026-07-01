import type { EntityConfigFactory } from '../../application/entities/entity-config'
import type { SchoolRepositories } from '../../ports/repositories/school-repositories'
import { z } from 'zod'
import { authorizeClassGroupLinked, authorizeClassGroupLinkedDelete, classGroupLinkedTenant, config, permissionAction, read, readByIds, write } from '../../application/entities/entity-config'
import { denyResourceAccess, Permission } from '../../capabilities/authorization'
import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'
import { parseDomain, zodDate } from '../shared/utils'

export enum AssessmentKind {
  Quiz = 'quiz',
  Homework = 'homework',
  Project = 'project',
  Other = 'other',
}

export const assessmentBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  classGroupId: z.string().trim().min(1, 'classGroupId must not be blank'),
  classSubjectId: z.string().trim().min(1, 'classSubjectId must not be blank'),
  periodId: z.string().trim().min(1, 'periodId must not be blank'),
  title: z.string().trim().min(1, 'title must not be blank'),
  kind: z.nativeEnum(AssessmentKind),
  maxScore: z.number().finite().positive('maxScore must be a finite, strictly positive number'),
  coefficient: z.number().finite().positive('coefficient must be a finite, strictly positive number').default(1),
  sessionId: z.string().trim().min(1, 'sessionId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  dueAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  metAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  date: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

function refineAssessment(data: any, ctx: z.RefinementCtx) {
  if (!data.sessionId && !data.dueAt && !data.date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'assessment must be linked to a session, have a due date, or have a date',
    })
  }
}

export const assessmentSchema = assessmentBaseSchema.superRefine(refineAssessment)

export type AssessmentData = z.infer<typeof assessmentSchema>
export type AssessmentInput = z.input<typeof assessmentSchema>

export const assessmentCreateSchema = assessmentBaseSchema.omit({ createdAt: true }).superRefine(refineAssessment)
export const assessmentUpdateSchema = assessmentBaseSchema.partial().required({ id: true }).superRefine(refineAssessment)

/**
 * Defines a graded activity for a classGroup subject.
 * Assessment results reference an assessment so scoring rules and grading intent stay explicit.
 */
export class Assessment {
  readonly data: AssessmentData

  constructor(args: AssessmentInput) {
    this.data = parseDomain(assessmentSchema, args)
  }

  get id() { return this.data.id }
  get classGroupId() { return this.data.classGroupId }
  get classSubjectId() { return this.data.classSubjectId }
  get periodId() { return this.data.periodId }
  get title() { return this.data.title }
  get kind() { return this.data.kind }
  get maxScore() { return this.data.maxScore }
  get coefficient() { return this.data.coefficient }
  get sessionId() { return this.data.sessionId }
  get dueAt() { return this.data.dueAt }
  get metAt() { return this.data.metAt }
  get date() { return this.data.date }
  get createdAt() { return this.data.createdAt }
}

export const assessmentConfig: EntityConfigFactory<Assessment> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.assessments,
    tenant: classGroupLinkedTenant('classGroupId'),
    read: read(permissionAction(Permission.GRADE_READ), readByIds((actor, ids) => policy.checkAssessmentAccess(actor, ids))),
    write: write(permissionAction(Permission.EXAM_CONFIG_CONFIGURE), authorizeClassGroupLinked(policy, 'classGroupId'), authorizeClassGroupLinkedDelete(policy)),
    gates: {
      preSave: validateAssessmentSave,
    },
    atomicExecution,
  })

async function validateAssessmentSave(
  assessment: Assessment,
  existing: Assessment | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const [classGroup, classSubject, period, session] = await Promise.all([
    repositories.classGroups.findById(assessment.classGroupId),
    repositories.classSubjects.findById(assessment.classSubjectId),
    repositories.academicPeriods.findById(assessment.periodId),
    assessment.sessionId ? repositories.sessions.findById(assessment.sessionId) : Promise.resolve(undefined),
  ])
  if (
    !classGroup
    || !classSubject
    || classSubject.classGroupId !== classGroup.id
    || !period
    || period.schoolId !== classGroup.schoolId
    || period.academicYearId !== classGroup.academicYearId
    || (assessment.sessionId && (
      !session
      || session.classGroupId !== classGroup.id
      || (session.classSubjectId && session.classSubjectId !== assessment.classSubjectId)
    ))
  ) {
    denyResourceAccess()
  }

  if (existing && !existing.metAt && assessment.metAt) {
    const results = await repositories.assessmentResults.list({ assessmentId: assessment.id })
    if (results.length > 0) {
      throw new BusinessRuleViolationError(
        'ASSESSMENT_RESULTS_ALREADY_RECORDED',
        `Assessment ${assessment.id} cannot be changed after results have been recorded`,
      )
    }
  }
}
