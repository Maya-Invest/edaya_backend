import type { Assessment } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'
import { denyResourceAccess } from '@edaya/authorization'
import { AssessmentKind, BusinessRuleViolationError, marksReviewSchema } from '@edaya/core'
import { assessmentMutationHooks } from '../../../../capabilities/academics/marks-mutation-hooks'
import { assertMarksDraft } from '../../../../capabilities/academics/marks-state'
import { assertNoClassGroupScheduleConflict } from '../../../workflows/schedule-conflicts'

import { config } from '../../entity-config'
import { classGroupLinkedTenant } from '../../entity-config/tenant'
// Extracted from domain/assessments/assessment.ts (PR3)
export const assessmentConfig: EntityConfigFactory<Assessment> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.assessments,
    tenant: classGroupLinkedTenant('classGroupId'),
    resource: 'assessments',
    writeLockGroup: 'academic-state',

    gates: {
      preSave: validateAssessmentSave,
      preDelete: async (assessment, repos) => {
        assertMarksDraft(assessment)
        if (assessment.marksReview.history.length)
          throw new BusinessRuleViolationError('ASSESSMENT_REVIEW_HISTORY_RETAINED', 'An evaluation with marks review history cannot be deleted')
        if (await repos.assessmentResults.count({ assessmentId: assessment.id }))
          throw new BusinessRuleViolationError('ASSESSMENT_HAS_MARKS', 'Delete draft marks before deleting an evaluation')
      },
    },
    hooks: assessmentMutationHooks,
    atomicExecution,
  })

async function validateAssessmentSave(
  assessment: Assessment,
  existing: Assessment | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  if (assessment.marksStatus !== (existing?.marksStatus ?? 'draft')
    || assessment.marksRevision !== (existing?.marksRevision ?? 0)
    || JSON.stringify(assessment.marksReview) !== JSON.stringify(existing?.marksReview ?? marksReviewSchema.parse({}))) {
    throw new BusinessRuleViolationError('MARKS_STATE_COMMAND_REQUIRED', 'Marks review state is managed by review commands')
  }
  if (existing && existing.marksStatus !== 'draft') {
    if (JSON.stringify(existing.data) !== JSON.stringify(assessment.data))
      assertMarksDraft(existing)
  }
  const [classGroup, classSubject, period, lessonSession] = await Promise.all([
    repositories.classGroups.findById(assessment.classGroupId),
    repositories.classSubjects.findById(assessment.classSubjectId),
    repositories.academicPeriods.findById(assessment.periodId),
    assessment.lessonSessionId ? repositories.lessonSessions.findById(assessment.lessonSessionId) : Promise.resolve(undefined),
  ])
  if (
    !classGroup
    || !classSubject
    || classSubject.classGroupId !== classGroup.id
    || !period
    || period.schoolId !== classGroup.schoolId
    || period.academicYearId !== classGroup.academicYearId
    || (assessment.lessonSessionId && (
      !lessonSession
      || lessonSession.classGroupId !== classGroup.id
      || lessonSession.classSubjectId !== assessment.classSubjectId
    ))
  ) {
    denyResourceAccess()
  }

  if (classSubject.isOffered === false) {
    throw new BusinessRuleViolationError(
      'CLASS_SUBJECT_NOT_OFFERED',
      `Class subject ${classSubject.id} is not offered and cannot be assessed`,
    )
  }

  if (
    assessment.startsAt
    && assessment.endsAt
    && assessment.kind !== AssessmentKind.Homework
  ) {
    const school = await repositories.schools.findById(classGroup.schoolId)
    if (school?.enforceScheduleConflicts) {
      await assertNoClassGroupScheduleConflict(repositories, {
        classGroupId: assessment.classGroupId,
        startsAt: assessment.startsAt,
        endsAt: assessment.endsAt,
        excludeAssessmentId: existing?.id,
      })
    }
  }

  if (existing) {
    const results = await repositories.assessmentResults.list({ assessmentId: assessment.id })
    if (results.length > 0 && (existing.classGroupId !== assessment.classGroupId || existing.classSubjectId !== assessment.classSubjectId || existing.periodId !== assessment.periodId)) {
      throw new BusinessRuleViolationError(
        'ASSESSMENT_RESULTS_ALREADY_RECORDED',
        `Assessment ${assessment.id} cannot be changed after results have been recorded`,
      )
    }
    if (results.some(result => result.score !== undefined && result.score > assessment.maxScore))
      throw new BusinessRuleViolationError('SCORE_EXCEEDS_MAX_SCORE', 'The maximum score would invalidate recorded marks')
  }
}
