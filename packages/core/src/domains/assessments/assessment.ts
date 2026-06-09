import type { SchoolRepositories } from '../../ports/school-repositories'
import type { EntityConfigFactory } from '../../shared'
import { Permission } from '../../authorization'
import { denyResourceAccess } from '../../authorization/authorization-error'
import { authorizeClassGroupLinked, authorizeClassGroupLinkedDelete, classGroupLinkedTenant, config, permissionAction, read, readByIds, write } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { requireNonBlank, requireOptionalNonBlank, requirePositiveNumber, requireValidDate } from '../utils'

export enum AssessmentKind {
  Quiz = 'quiz',
  Homework = 'homework',
  Project = 'project',
  Other = 'other',
}

export interface AssessmentArgs {
  id: string
  classGroupId: string
  classSubjectId: string
  periodId: string
  title: string
  kind: AssessmentKind
  maxScore: number
  coefficient?: number
  sessionId?: string | null
  dueAt?: Date | null
  metAt?: Date | null
  date?: Date | null
  createdAt?: Date
}

/**
 * Defines a graded activity for a classGroup subject.
 * Assessment results reference an assessment so scoring rules and grading intent stay explicit.
 */
export class Assessment {
  readonly id: string
  readonly classGroupId: string
  readonly classSubjectId: string
  readonly periodId: string
  readonly title: string
  readonly kind: AssessmentKind
  readonly maxScore: number
  readonly coefficient: number
  readonly sessionId?: string
  readonly dueAt?: Date
  readonly metAt?: Date
  readonly date?: Date
  readonly createdAt: Date

  constructor({
    id,
    classGroupId,
    classSubjectId,
    periodId,
    title,
    kind,
    maxScore,
    coefficient = 1,
    sessionId,
    dueAt,
    metAt,
    date,
    createdAt,
  }: AssessmentArgs) {
    this.id = requireNonBlank(id, 'id')
    this.classGroupId = requireNonBlank(classGroupId, 'classGroupId')
    this.classSubjectId = requireNonBlank(classSubjectId, 'classSubjectId')
    this.periodId = requireNonBlank(periodId, 'periodId')
    this.title = requireNonBlank(title, 'title')
    this.kind = kind
    this.maxScore = requirePositiveNumber(maxScore, 'maxScore')
    this.coefficient = requirePositiveNumber(coefficient, 'coefficient')
    this.sessionId = requireOptionalNonBlank(sessionId, 'sessionId')
    this.dueAt = dueAt ? requireValidDate(dueAt, 'dueAt') : undefined
    this.metAt = metAt ? requireValidDate(metAt, 'metAt') : undefined
    this.date = date ? requireValidDate(date, 'date') : undefined
    this.createdAt = createdAt ? requireValidDate(createdAt, 'createdAt') : new Date()

    if (!this.sessionId && !this.dueAt && !this.date) {
      throw new Error('assessment must be linked to a session, have a due date, or have a date')
    }
  }
}

export const assessmentConfig: EntityConfigFactory<Assessment> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.assessments,
    tenant: classGroupLinkedTenant('classGroupId'),
    read: read(permissionAction(policy, Permission.GRADE_READ), readByIds((actor, ids) => policy.checkAssessmentAccess(actor, ids))),
    write: write(permissionAction(policy, Permission.EXAM_CONFIG_CONFIGURE), authorizeClassGroupLinked(policy, 'classGroupId'), authorizeClassGroupLinkedDelete(policy)),
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
