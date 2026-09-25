import type { LessonSession } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'
import { denyResourceAccess } from '@edaya/authorization'
import { BusinessRuleViolationError, OccurrenceStatus, TeacherAssignmentKind, TeacherAssignmentStatus } from '@edaya/core'
import { assertNoSessionConflict } from '../../../workflows/schedule-conflicts'
import { config } from '../../entity-config'
import { classGroupLinkedTenant } from '../../entity-config/tenant'

// Extracted from domain/scheduling/lesson-session.ts (PR3)
export const lessonSessionConfig: EntityConfigFactory<LessonSession> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.lessonSessions,
    tenant: classGroupLinkedTenant('classGroupId'),
    resource: 'lessonSessions',
    writeLockGroup: 'academic-state',

    gates: {
      preSave: validateLessonSessionSave,
      preDelete: async (session, repos) => {
        if (await repos.assessments.count({ lessonSessionId: session.id, marksStatus: { $ne: 'draft' } }))
          throw new BusinessRuleViolationError('ASSESSMENT_MARKS_FROZEN', 'Submitted evaluations depend on this lesson session')
      },
    },
    atomicExecution,
  })

export async function validateLessonSessionSave(
  lessonSession: LessonSession,
  existing: LessonSession | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  if (existing && (lessonSession.startsAt.getTime() !== existing.startsAt.getTime() || lessonSession.classGroupId !== existing.classGroupId || lessonSession.classSubjectId !== existing.classSubjectId)) {
    if (await repositories.assessments.count({ lessonSessionId: existing.id, marksStatus: { $ne: 'draft' } }))
      throw new BusinessRuleViolationError('ASSESSMENT_MARKS_FROZEN', 'Return affected marks sheets before changing their scheduled context')
  }
  if (existing && (existing.status === OccurrenceStatus.Completed || existing.status === OccurrenceStatus.Cancelled)) {
    if (
      lessonSession.status !== existing.status
      || lessonSession.startsAt.getTime() !== existing.startsAt.getTime()
      || lessonSession.endsAt.getTime() !== existing.endsAt.getTime()
    ) {
      throw new BusinessRuleViolationError('OCCURRENCE_IMMUTABLE', `Lesson session ${existing.id} is ${existing.status} and cannot be modified`)
    }
  }
  await requireValidClassSubject(lessonSession.classSubjectId, lessonSession.classGroupId, repositories)

  if ((!existing && lessonSession.timetableGenerated) || (existing && lessonSession.timetableGenerated !== existing.timetableGenerated)) {
    throw new BusinessRuleViolationError(
      'TIMETABLE_GENERATED_STATE_WORKFLOW_ONLY',
      'Generated timetable state can only be created or transitioned by timetable workflows',
    )
  }

  const scheduleChanged = !existing
    || lessonSession.classGroupId !== existing.classGroupId
    || lessonSession.startsAt.getTime() !== existing.startsAt.getTime()
    || lessonSession.endsAt.getTime() !== existing.endsAt.getTime()

  if (scheduleChanged && !lessonSession.scheduleId && !lessonSession.timetableGenerated) {
    const assignments = await repositories.teacherAssignments.list({
      classSubjectId: lessonSession.classSubjectId,
      kind: TeacherAssignmentKind.Subject,
      status: TeacherAssignmentStatus.Active,
    })
    const teacherIds = assignments
      .filter(assignment => (!assignment.startsAt || assignment.startsAt < lessonSession.endsAt)
        && (!assignment.endsAt || lessonSession.startsAt < assignment.endsAt))
      .map(assignment => assignment.teacherId)

    await assertNoSessionConflict(repositories, {
      classGroupId: lessonSession.classGroupId,
      teacherIds,
      startsAt: lessonSession.startsAt,
      endsAt: lessonSession.endsAt,
      excludeSessionId: lessonSession.id,
    })
  }
}

async function requireValidClassSubject(
  classSubjectId: string,
  classGroupId: string,
  repositories: SchoolRepositories,
): Promise<void> {
  const classSubject = await repositories.classSubjects.findById(classSubjectId)
  if (!classSubject || classSubject.classGroupId !== classGroupId) {
    denyResourceAccess()
  }
}
