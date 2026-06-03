import type { Assessment } from '../../../entities/assessments/assessment'
import type { SchoolRepositories } from '../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../../shared'
import { denyResourceAccess } from '../../../authorization/authorization-error'
import { action, authorizeClassGroupLinked, authorizeClassGroupLinkedDelete, classGroupLinkedTenant, config, read, readByIds, write } from '../../../shared'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'

export const assessmentConfig: EntityConfigFactory<Assessment> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.assessments,
    tenant: classGroupLinkedTenant('classGroupId'),
    read: read(action(policy, 'assessments.read_results'), readByIds((actor, ids) => policy.checkAssessmentAccess(actor, ids))),
    write: write(action(policy, 'assessments.manage_configuration'), authorizeClassGroupLinked(policy, 'classGroupId'), authorizeClassGroupLinkedDelete(policy)),
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
