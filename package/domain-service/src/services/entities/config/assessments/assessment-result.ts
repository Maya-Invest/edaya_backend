import type { AssessmentResult } from '@edaya/core'

import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory, EntityTenantResolver } from '../../entity-config'
import { denyResourceAccess } from '@edaya/authorization'
import { BusinessRuleViolationError, ReportCardResultStatus, StudentClassEnrollmentStatus } from '@edaya/core'
import { config } from '../../entity-config'

import { indirectTenant } from '../../entity-config/tenant'
// Extracted from domain/assessments/assessment-result.ts (PR3)
export const assessmentResultConfig: EntityConfigFactory<AssessmentResult> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.assessmentResults,
    tenant: assessmentResultTenant(),
    resource: 'assessmentResults',

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
