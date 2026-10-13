import type { AssessmentResult } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory, EntityTenantResolver } from '../../entity-config'

import { denyResourceAccess } from '@edaya/authorization'
import { BusinessRuleViolationError, ReportCardResultStatus } from '@edaya/core'
import { assessmentGradingPolicy, captureGradeEntry } from '../../../../capabilities/academics/grading'
import { prepareMarkBatchValidation } from '../../../../capabilities/academics/marks-batch-context'
import { markMutationHooks } from '../../../../capabilities/academics/marks-mutation-hooks'
import { assertMarkDesignation, assertMarksDraft, assessmentRoster } from '../../../../capabilities/academics/marks-state'
import { normalizeCommandRequest } from '../../../commands/command-execution'
import { config } from '../../entity-config'

import { indirectTenant } from '../../entity-config/tenant'
// Extracted from domain/assessments/assessment-result.ts (PR3)
export const assessmentResultConfig: EntityConfigFactory<AssessmentResult> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.assessmentResults,
    tenant: assessmentResultTenant(),
    resource: 'assessmentResults',
    writeLockGroup: 'academic-state',

    gates: {
      prepareBatch: prepareMarkBatchValidation,
      preSave: validateAssessmentResultSave,
      preDelete: validateAssessmentResultDelete,
    },
    hooks: markMutationHooks,
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
  assertMarksDraft(assessment)
  if (result.revision !== (_existing?.revision ?? 0))
    throw new BusinessRuleViolationError('MARKS_STATE_COMMAND_REQUIRED', 'Mark revisions are command owned')
  assertMarkDesignation(result)
  const policy = await assessmentGradingPolicy(repositories, assessment)
  if (policy || result.originalEntry || result.calculation) {
    const expected = captureGradeEntry(result, assessment, policy, _existing)
    if (normalizeCommandRequest({ entry: result.originalEntry, calculation: result.calculation }) !== normalizeCommandRequest({ entry: expected.originalEntry, calculation: expected.calculation }))
      throw new BusinessRuleViolationError('GRADING_COMMAND_REQUIRED', 'Grade provenance and calculations are command owned')
  }
  if (_existing && (_existing.assessmentId !== result.assessmentId || _existing.studentId !== result.studentId))
    throw new BusinessRuleViolationError('MARK_TARGET_IMMUTABLE', 'A mark cannot be reassigned to another student or evaluation')
  const duplicate = await repositories.assessmentResults.findOne({ assessmentId: result.assessmentId, studentId: result.studentId })
  if (duplicate && duplicate.id !== result.id)
    throw new BusinessRuleViolationError('DUPLICATE_ASSESSMENT_MARK', 'A student can have only one mark per evaluation')
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
  if (!(await assessmentRoster(assessment, repositories)).includes(result.studentId)) {
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
  assertMarksDraft(assessment)
  const reportCard = await repositories.results.findOne({
    studentId: result.studentId,
    periodId: assessment.periodId,
  })
  if (reportCard?.status === ReportCardResultStatus.Published) {
    throw new BusinessRuleViolationError('PUBLISHED_REPORT_CARD_IMMUTABLE', `Published report card for student ${result.studentId} and period ${assessment.periodId} is immutable`)
  }
}
