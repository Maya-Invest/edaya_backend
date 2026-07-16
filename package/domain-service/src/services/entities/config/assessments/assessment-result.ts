import type { AuthorizationPolicy } from '@edaya/authorization'
import type { AssessmentResult, CoreEntityRepositories } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory, EntityTenantResolver, EntityWriteAuthorization } from '../../entity-config'
import { AssessmentOperations, denyResourceAccess, GradeOperations } from '@edaya/authorization'
import { BusinessRuleViolationError, ReportCardResultStatus, StudentClassEnrollmentStatus } from '@edaya/core'
import { anyOperationModule, authorizeDeleteWithOperation, authorizeSaveWithOperation, config, operationModule, read, write } from '../../entity-config'

import { unique } from '../../entity-config/helper-utils'
import { indirectTenant } from '../../entity-config/tenant'
// Extracted from domain/assessments/assessment-result.ts (PR3)
export const assessmentResultConfig: EntityConfigFactory<AssessmentResult> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.assessmentResults,
    tenant: assessmentResultTenant(),
    read: read(
      anyOperationModule([GradeOperations.read, AssessmentOperations.read]),
      async (actor, entities, repos) => {
        const assessments = await repos.assessments.findByIds(unique(entities.map(entity => entity.assessmentId)))
        await policy.checkAssessmentAccess(actor, unique(assessments.map(assessment => assessment.id)))
      },
    ),
    write: write(
      operationModule(GradeOperations.input),
      authorizeSaveWithOperation(
        GradeOperations.input,
        resolveGradeInputContext,
        authorizeAssessmentResultResource(policy),
      ),
      authorizeDeleteWithOperation(
        GradeOperations.input,
        (entity, repositories) => resolveGradeInputContext(entity, undefined, repositories),
        authorizeAssessmentResultDeleteResource(policy),
      ),
    ),
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

async function resolveGradeInputContext(
  entity: AssessmentResult,
  _existing: AssessmentResult | undefined,
  repositories: CoreEntityRepositories,
) {
  const assessment = await repositories.assessments.findById(entity.assessmentId)
  if (!assessment) {
    denyResourceAccess()
  }
  return { classSubjectId: assessment.classSubjectId }
}

function authorizeAssessmentResultResource(
  policy: AuthorizationPolicy,
): EntityWriteAuthorization<AssessmentResult>['authorizeSave'] {
  return async (actor, entity, _existing, _repositories) => {
    await authorizeAssessmentResultAccess(policy, actor, entity)
  }
}

function authorizeAssessmentResultDeleteResource(
  policy: AuthorizationPolicy,
): EntityWriteAuthorization<AssessmentResult>['authorizeDelete'] {
  return async (actor, entity, _repositories) => {
    await authorizeAssessmentResultAccess(policy, actor, entity)
  }
}

async function authorizeAssessmentResultAccess(
  policy: AuthorizationPolicy,
  actor: Parameters<EntityWriteAuthorization<AssessmentResult>['authorizeSave']>[0],
  entity: AssessmentResult,
): Promise<void> {
  await policy.checkAssessmentAccess(actor, [entity.assessmentId])
  await policy.checkStudentAccess(actor, [entity.studentId])
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
