import type { AuthorizationPolicy } from '../../../authorization'
import type { AssessmentResult } from '../../../entities/assessments/assessment-result'
import type { SchoolRepositories } from '../../../ports'
import type { EntityConfigFactory } from '../../../shared'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../managed-entity-service'
import { denyResourceAccess, Permission } from '../../../authorization'
import { ReportCardResultStatus, StudentClassEnrollmentStatus } from '../../../entities'
import { config, indirectTenant, permissionAction, read, unique, write } from '../../../shared'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'

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
