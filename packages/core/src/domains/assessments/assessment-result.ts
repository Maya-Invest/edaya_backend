import type { AuthorizationPolicy } from '../../authorization'
import type { SchoolRepositories } from '../../ports'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../services/managed-entity-service'
import type { EntityConfigFactory } from '../../shared'
import { denyResourceAccess, Permission } from '../../authorization'
import { ReportCardResultStatus, StudentClassEnrollmentStatus } from '../../domains'
import { config, indirectTenant, permissionAction, read, unique, write } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { requireNonBlank, requireNonNegativeNumber, requireOptionalNonBlank, roundTo2 } from '../utils'

export enum DeadlineComplianceStatus {
  Met = 'met',
  Late = 'late',
  Missed = 'missed',
  Excused = 'excused',
}

export interface AssessmentResultArgs {
  id: string
  studentId: string
  assessmentId: string
  score?: number | null
  status?: DeadlineComplianceStatus | null
  notes?: string | null
  createdBy?: string
  createdAt?: Date
}

/**
 * Represents a student's assessment result/score for a specific subject within a classGroup program.
 * Assessment results are associated with an academic period and form the basis of the report card.
 * Also tracks student submission compliance status (e.g. met, late, missed, excused) for the assessment.
 */
export class AssessmentResult {
  readonly id: string
  readonly studentId: string
  readonly assessmentId: string
  readonly score?: number
  readonly status?: DeadlineComplianceStatus
  readonly notes?: string
  readonly createdBy?: string
  readonly createdAt: Date

  constructor({
    id,
    studentId,
    assessmentId,
    score,
    status,
    notes,
    createdBy,
    createdAt,
  }: AssessmentResultArgs) {
    this.id = requireNonBlank(id, 'id')
    this.studentId = requireNonBlank(studentId, 'studentId')
    this.assessmentId = requireNonBlank(assessmentId, 'assessmentId')

    if (score !== undefined && score !== null) {
      this.score = roundTo2(requireNonNegativeNumber(score, 'score'))
    }

    this.status = status ?? undefined
    this.notes = requireOptionalNonBlank(notes, 'notes')
    this.createdBy = requireOptionalNonBlank(createdBy, 'createdBy')
    this.createdAt = createdAt ?? new Date()
  }
}

export const assessmentResultConfig: EntityConfigFactory<AssessmentResult> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.assessmentResults,
    tenant: assessmentResultTenant(),
    read: read(permissionAction(policy, Permission.GRADE_READ), async (actor, entities, repos) => {
      const assessments = await repos.assessments.findByIds(unique(entities.map(entity => entity.assessmentId)))
      await policy.checkAssessmentAccess(actor, unique(assessments.map(assessment => assessment.id)))
    }),
    write: write(permissionAction(policy, Permission.GRADE_INPUT), authorizeAssessmentResult(policy), authorizeAssessmentResultDelete(policy)),
    gates: {
      preSave: validateAssessmentResultSave,
      preDelete: validateAssessmentResultDelete,
    },
    atomicExecution,
  })

function assessmentResultTenant(): EntityTenantResolver<AssessmentResult> {
  return indirectTenant(async (entity, repositories) => {
    const assessment = await repositories.assessments.findById(entity.assessmentId)
    if (!assessment)
      return undefined
    const classGroup = await repositories.classGroups.findById(assessment.classGroupId)
    return classGroup?.schoolId
  })
}

export async function validateAssessmentResultSave(
  result: AssessmentResult,
  _existing: AssessmentResult | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const assessment = await repositories.assessments.findById(result.assessmentId)
  if (!assessment) {
    denyResourceAccess()
  }
  const [classGroup, student, period] = await Promise.all([
    repositories.classGroups.findById(assessment.classGroupId),
    repositories.students.findById(result.studentId),
    repositories.academicPeriods.findById(assessment.periodId),
  ])
  if (
    !classGroup
    || !student
    || student.schoolId !== classGroup.schoolId
    || !period
    || period.academicYearId !== classGroup.academicYearId
    || period.schoolId !== classGroup.schoolId
  ) {
    denyResourceAccess()
  }
  if (result.score !== undefined && result.score > assessment.maxScore) {
    throw new BusinessRuleViolationError('SCORE_EXCEEDS_MAX_SCORE', 'score must not exceed assessment maxScore')
  }
  const activeEnrollment = await repositories.enrollments.findOne({
    studentId: result.studentId,
    classGroupId: classGroup.id,
    status: StudentClassEnrollmentStatus.Active,
  })
  if (!activeEnrollment) {
    throw new BusinessRuleViolationError('ACTIVE_ENROLLMENT_REQUIRED', `Student ${result.studentId} does not have an active enrollment in classGroup ${classGroup.id}`)
  }
  const reportCard = await repositories.results.findOne({
    studentId: result.studentId,
    periodId: assessment.periodId,
  })
  if (reportCard?.status === ReportCardResultStatus.Published) {
    throw new BusinessRuleViolationError('PUBLISHED_REPORT_CARD_IMMUTABLE', `Published report card for student ${result.studentId} and period ${assessment.periodId} is immutable`)
  }
}

function authorizeAssessmentResult(policy: AuthorizationPolicy): EntityWriteAuthorization<AssessmentResult>['authorizeSave'] {
  return async (actor, entity) => {
    await policy.checkAssessmentAccess(actor, [entity.assessmentId])
    await policy.checkStudentAccess(actor, [entity.studentId])
  }
}

function authorizeAssessmentResultDelete(policy: AuthorizationPolicy): EntityWriteAuthorization<AssessmentResult>['authorizeDelete'] {
  return async (actor, entity) => {
    await policy.checkAssessmentAccess(actor, [entity.assessmentId])
    await policy.checkStudentAccess(actor, [entity.studentId])
  }
}

async function validateAssessmentResultDelete(
  result: AssessmentResult,
  repositories: SchoolRepositories,
): Promise<void> {
  const assessment = await repositories.assessments.findById(result.assessmentId)
  if (!assessment) {
    denyResourceAccess()
  }
  const reportCard = await repositories.results.findOne({
    studentId: result.studentId,
    periodId: assessment.periodId,
  })
  if (reportCard?.status === ReportCardResultStatus.Published) {
    throw new BusinessRuleViolationError('PUBLISHED_REPORT_CARD_IMMUTABLE', `Published report card for student ${result.studentId} and period ${assessment.periodId} is immutable`)
  }
}
