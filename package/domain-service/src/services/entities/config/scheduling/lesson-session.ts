import { Permission } from '@edaya/core';

import type { LessonSession } from '@edaya/core';
import type { SchoolRepositories } from '../../../../ports/school-repositories';
import type { EntityConfigFactory } from '../../entity-config';
import { denyResourceAccess } from '@edaya/authorization';
import { BusinessRuleViolationError, OccurrenceStatus, TeacherAssignmentKind, TeacherAssignmentStatus } from '@edaya/core';
import { assertNoSessionConflict } from '../../../workflows/schedule-conflicts';
import { config } from '../../entity-config';
import { classGroupLinkedTenant } from '../../entity-config/tenant';

// Extracted from domain/scheduling/lesson-session.ts (PR3)
export const lessonSessionConfig: EntityConfigFactory<LessonSession> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.lessonSessions,
    tenant: classGroupLinkedTenant('classGroupId'),
    authorization: { resource: 'lessonSessions', read: [Permission.QUERY_TIMETABLE_READ, Permission.TIMETABLE_UPDATE, Permission.TIMETABLE_CREATE, Permission.GRADE_INPUT, Permission.ATTENDANCE_RECORD, Permission.CLASS_LOGBOOK_CREATE, Permission.CLASS_LOGBOOK_UPDATE, Permission.DISCIPLINE_CREATE], write: resolveLessonSessionWriteAction, delete: Permission.TIMETABLE_UPDATE },
    
    gates: {
      preSave: validateLessonSessionSave,
    },
    atomicExecution,
  })

export function isLessonSessionLogbookOnlyUpdate(
  entity: LessonSession,
  existing: LessonSession,
): boolean {
  return entity.schoolId === existing.schoolId
    && entity.classGroupId === existing.classGroupId
    && entity.scheduleId === existing.scheduleId
    && entity.timetableGenerated === existing.timetableGenerated
    && entity.timetableTeacherIds.join('|') === existing.timetableTeacherIds.join('|')
    && entity.classSubjectId === existing.classSubjectId
    && entity.status === existing.status
    && entity.isException === existing.isException
    && entity.startsAt.getTime() === existing.startsAt.getTime()
    && entity.endsAt.getTime() === existing.endsAt.getTime()
    && entity.createdAt.getTime() === existing.createdAt.getTime()
}

export function isLessonSessionAttendanceCompletionUpdate(
  entity: LessonSession,
  existing: LessonSession,
): boolean {
  return entity.schoolId === existing.schoolId
    && entity.classGroupId === existing.classGroupId
    && entity.scheduleId === existing.scheduleId
    && entity.timetableGenerated === existing.timetableGenerated
    && entity.timetableTeacherIds.join('|') === existing.timetableTeacherIds.join('|')
    && entity.classSubjectId === existing.classSubjectId
    && entity.isException === existing.isException
    && entity.startsAt.getTime() === existing.startsAt.getTime()
    && entity.endsAt.getTime() === existing.endsAt.getTime()
    && entity.displayLabel === existing.displayLabel
    && entity.sessionNote === existing.sessionNote
    && entity.createdAt.getTime() === existing.createdAt.getTime()
    && existing.status === OccurrenceStatus.Pending
    && entity.status === OccurrenceStatus.Completed
}

function resolveLessonSessionWriteAction(
  entity: LessonSession,
  existing: LessonSession | undefined,
) {
  if (!existing) {
    return Permission.TIMETABLE_UPDATE
  }
  if (isLessonSessionLogbookOnlyUpdate(entity, existing)) {
    return Permission.CLASS_LOGBOOK_UPDATE
  }
  if (isLessonSessionAttendanceCompletionUpdate(entity, existing)) {
    return Permission.ATTENDANCE_RECORD
  }
  return Permission.TIMETABLE_UPDATE
}



export async function validateLessonSessionSave(
  lessonSession: LessonSession,
  existing: LessonSession | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
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
