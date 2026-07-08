import type { SchoolRepositories } from '@edaya/school-service'
import { AssessmentKind, BusinessRuleViolationError, OccurrenceStatus } from '@edaya/core'

export interface ClassGroupScheduleConflictInput {
  classGroupId: string
  startsAt: Date
  endsAt: Date
  excludeLessonSessionId?: string
  excludeActivitySessionId?: string
  excludeAssessmentId?: string
}

export async function assertNoClassGroupScheduleConflict(
  repositories: SchoolRepositories,
  input: ClassGroupScheduleConflictInput,
): Promise<void> {
  const { classGroupId, startsAt, endsAt, excludeLessonSessionId, excludeActivitySessionId, excludeAssessmentId } = input
  const [lessonSessions, activitySessions, assessments] = await Promise.all([
    repositories.lessonSessions.list({ classGroupId }),
    repositories.activitySessions.list({ classGroupId }),
    repositories.assessments.list({ classGroupId }),
  ])

  for (const occurrence of [...lessonSessions, ...activitySessions]) {
    if (occurrence.id === excludeLessonSessionId || occurrence.id === excludeActivitySessionId) {
      continue
    }
    if (occurrence.status === OccurrenceStatus.Cancelled) {
      continue
    }
    if (startsAt < occurrence.endsAt && occurrence.startsAt < endsAt) {
      const kind = 'classSubjectId' in occurrence ? 'lesson session' : 'activity session'
      throw new BusinessRuleViolationError(
        'SCHEDULE_CONFLICT',
        `Occurrence overlaps with ${kind} ${occurrence.id}`,
      )
    }
  }

  for (const assessment of assessments) {
    if (assessment.id === excludeAssessmentId) {
      continue
    }
    if (assessment.kind === AssessmentKind.Homework || !assessment.startsAt || !assessment.endsAt) {
      continue
    }
    if (startsAt < assessment.endsAt && assessment.startsAt < endsAt) {
      throw new BusinessRuleViolationError(
        'SCHEDULE_CONFLICT',
        `Occurrence overlaps with assessment ${assessment.id}`,
      )
    }
  }
}
