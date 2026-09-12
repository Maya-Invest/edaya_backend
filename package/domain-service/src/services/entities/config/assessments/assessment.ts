import { Permission } from '@edaya/core';

import type { Assessment } from '@edaya/core';
import type { SchoolRepositories } from '../../../../ports/school-repositories';
import type { EntityConfigFactory } from '../../entity-config';
import { denyResourceAccess } from '@edaya/authorization';
import { AssessmentKind, BusinessRuleViolationError } from '@edaya/core';
import { assertNoClassGroupScheduleConflict } from '../../../workflows/schedule-conflicts';
import { config } from '../../entity-config';

import { classGroupLinkedTenant } from '../../entity-config/tenant';
// Extracted from domain/assessments/assessment.ts (PR3)
export const assessmentConfig: EntityConfigFactory<Assessment> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.assessments,
    tenant: classGroupLinkedTenant('classGroupId'),
    authorization: { resource: 'assessments', read: [Permission.GRADE_READ, Permission.EXAM_CONFIG_CONFIGURE, Permission.QUERY_CURRICULUM_PROGRESS_READ, Permission.GRADE_INPUT, Permission.ATTENDANCE_RECORD, Permission.CLASS_LOGBOOK_CREATE, Permission.CLASS_LOGBOOK_UPDATE, Permission.DISCIPLINE_CREATE], write: [Permission.GRADE_INPUT] },
    
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

  if (existing && !existing.completedAt && assessment.completedAt) {
    const results = await repositories.assessmentResults.list({ assessmentId: assessment.id })
    if (results.length > 0) {
      throw new BusinessRuleViolationError(
        'ASSESSMENT_RESULTS_ALREADY_RECORDED',
        `Assessment ${assessment.id} cannot be changed after results have been recorded`,
      )
    }
  }
}
