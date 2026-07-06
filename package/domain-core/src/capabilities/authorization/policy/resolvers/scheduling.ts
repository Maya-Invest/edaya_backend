import type { AttendanceRecord } from '../../../../domain/scheduling/attendance-record'
import type { SchoolRepositories } from '../../../../ports/repositories/school-repositories'
import type { ActorMetadata, TeacherActorMetadata } from '../../model/actor'
import {
  assertHomeroomCapability,
} from '../../capabilities/assert-homeroom-capability'
import {
  assertTeachingCapability,
  teacherScopeCoversClassSubject,
} from '../../capabilities/assert-teaching-capability'
import { HomeroomCapability } from '../../capabilities/homeroom-capability'
import { TeachingCapability } from '../../capabilities/teaching-capability'
import {
  actorGrantCoversAnyResourcePath,
  actorHasSchoolWideGrant,
} from '../../grants/actor-grant-checks'
import { AuthorizationError, AuthorizationErrorCode } from '../../model/errors'
import { ASSIGNMENT_SCOPED_PERMISSIONS } from '../../permissions/assignment-scoped-permissions'
import { resourcePathForActivity, resourcePathForClassSubject } from '../../scope/resolve-resource-path'
import { checkClassGroupAccess } from './academic'
import {
  SCHOOL_WIDE_SESSION_ACCESS_PERMISSIONS,
} from './permission-sets'
import { checkStudentAccess } from './student'

export async function checkActivitySessionAccess(
  actor: ActorMetadata,
  activitySessionIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  if (activitySessionIds.length === 0) {
    return
  }

  if (actorHasSchoolWideGrant(actor, SCHOOL_WIDE_SESSION_ACCESS_PERMISSIONS)) {
    return
  }

  const uniqueIds = [...new Set(activitySessionIds)]
  const activitySessions = await repos.activitySessions.findByIds(uniqueIds)
  if (activitySessions.length !== uniqueIds.length) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  const classGroupIds = new Set<string>()
  for (const session of activitySessions) {
    const resourcePath = resourcePathForActivity(session.activityId, session.classGroupId)
    if (actorGrantCoversAnyResourcePath(actor, ASSIGNMENT_SCOPED_PERMISSIONS, resourcePath)) {
      continue
    }
    classGroupIds.add(session.classGroupId)
  }

  if (classGroupIds.size === 0) {
    return
  }

  await checkClassGroupAccess(actor, [...classGroupIds], repos)
}

export async function checkLessonSessionAccess(
  actor: ActorMetadata,
  lessonSessionIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  if (lessonSessionIds.length === 0) {
    return
  }

  if (actor.kind !== 'teacher' && actorHasSchoolWideGrant(actor, SCHOOL_WIDE_SESSION_ACCESS_PERMISSIONS)) {
    return
  }

  const uniqueIds = [...new Set(lessonSessionIds)]
  const lessonSessions = await repos.lessonSessions.findByIds(uniqueIds)
  if (lessonSessions.length !== uniqueIds.length) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  if (actor.kind === 'teacher') {
    for (const session of lessonSessions) {
      if (teacherScopeCoversClassSubject(actor, session.classSubjectId)) {
        continue
      }
      if (actor.teacherScope.homeroom.classGroupIds.includes(session.classGroupId)) {
        continue
      }
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
    return
  }

  if (actorHasSchoolWideGrant(actor, SCHOOL_WIDE_SESSION_ACCESS_PERMISSIONS)) {
    return
  }

  const classGroupIds = new Set<string>()
  for (const session of lessonSessions) {
    const resourcePath = resourcePathForClassSubject(session.classGroupId, session.classSubjectId)
    if (actorGrantCoversAnyResourcePath(actor, ASSIGNMENT_SCOPED_PERMISSIONS, resourcePath)) {
      continue
    }
    classGroupIds.add(session.classGroupId)
  }

  if (classGroupIds.size === 0) {
    return
  }

  await checkClassGroupAccess(actor, [...classGroupIds], repos)
}

export async function checkAttendanceRecordAccess(
  actor: ActorMetadata,
  records: readonly AttendanceRecord[],
  repos: SchoolRepositories,
): Promise<void> {
  if (records.length === 0) {
    return
  }

  if (actor.kind === 'teacher') {
    await checkTeacherAttendanceRecordAccess(actor, records, repos)
    return
  }

  const studentIds = [...new Set(records.map(record => record.studentId))]
  const lessonSessionIds = [...new Set(records.map(record => record.lessonSessionId).filter((id): id is string => Boolean(id)))]
  const attendanceIds = [...new Set(records.map(record => record.attendanceId).filter((id): id is string => Boolean(id)))]

  const activitySessionIds = [...new Set(records.map(record => record.activitySessionId).filter((id): id is string => Boolean(id)))]

  await checkStudentAccess(actor, studentIds, repos)

  if (lessonSessionIds.length > 0) {
    await checkLessonSessionAccess(actor, lessonSessionIds, repos)
  }

  if (activitySessionIds.length > 0) {
    await checkActivitySessionAccess(actor, activitySessionIds, repos)
  }

  if (attendanceIds.length > 0) {
    const attendances = await repos.attendances.findByIds(attendanceIds)
    if (attendances.length !== attendanceIds.length) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
    const classGroupIds = [...new Set(attendances.map(attendance => attendance.classGroupId))]
    await checkClassGroupAccess(actor, classGroupIds, repos)
  }
}

async function checkTeacherAttendanceRecordAccess(
  actor: TeacherActorMetadata,
  records: readonly AttendanceRecord[],
  repos: SchoolRepositories,
): Promise<void> {
  await checkStudentAccess(actor, [...new Set(records.map(record => record.studentId))], repos)

  for (const record of records) {
    if (record.lessonSessionId) {
      const lessonSession = await repos.lessonSessions.findById(record.lessonSessionId)
      if (!lessonSession) {
        throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
      }
      assertTeachingCapability(actor, TeachingCapability.RecordSessionAttendance, {
        classSubjectId: lessonSession.classSubjectId,
      })
      continue
    }

    if (record.attendanceId) {
      const attendance = await repos.attendances.findById(record.attendanceId)
      if (!attendance) {
        throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
      }
      assertHomeroomCapability(actor, HomeroomCapability.RecordDailyAttendance, {
        classGroupId: attendance.classGroupId,
      })
      continue
    }

    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}
