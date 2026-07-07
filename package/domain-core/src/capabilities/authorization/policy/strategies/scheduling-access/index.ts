import type { AttendanceRecord } from '../../../../../domain/scheduling/attendance-record'
import type { SchoolRepositories } from '../../../../../ports/repositories/school-repositories'
import type { ActorMetadata, TeacherActorMetadata } from '../../../model/actor'
import {
  assertHomeroomCapability,
} from '../../../capabilities/assert-homeroom-capability'
import {
  assertTeachingCapability,
  teacherScopeCoversClassSubject,
} from '../../../capabilities/assert-teaching-capability'
import { HomeroomCapability } from '../../../capabilities/homeroom-capability'
import { TeachingCapability } from '../../../capabilities/teaching-capability'
import {
  actorGrantCoversAnyResourcePath,
  actorHasSchoolWideGrant,
} from '../../../grants/actor-grant-checks'
import { AuthorizationError, AuthorizationErrorCode } from '../../../model/errors'
import { ASSIGNMENT_SCOPED_PERMISSIONS } from '../../../permissions/assignment-scoped-permissions'
import { resourcePathForActivity, resourcePathForClassSubject } from '../../../scope/resolve-resource-path'
import { dispatchClassGroupAccess } from '../../compose'
import { SCHOOL_WIDE_SESSION_ACCESS_PERMISSIONS } from '../../resolvers/permission-sets'
import { checkStudentAccess } from '../../resolvers/student'

export async function staffLessonSessionAccess(
  actor: ActorMetadata,
  lessonSessionIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  if (actorHasSchoolWideGrant(actor, SCHOOL_WIDE_SESSION_ACCESS_PERMISSIONS)) {
    return
  }

  const uniqueIds = [...new Set(lessonSessionIds)]
  const lessonSessions = await repos.lessonSessions.findByIds(uniqueIds)
  if (lessonSessions.length !== uniqueIds.length) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
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

  await dispatchClassGroupAccess(actor, [...classGroupIds], repos)
}

export async function teacherLessonSessionAccess(
  actor: TeacherActorMetadata,
  lessonSessionIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  const uniqueIds = [...new Set(lessonSessionIds)]
  const lessonSessions = await repos.lessonSessions.findByIds(uniqueIds)
  if (lessonSessions.length !== uniqueIds.length) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  for (const session of lessonSessions) {
    if (teacherScopeCoversClassSubject(actor, session.classSubjectId)) {
      continue
    }
    if (actor.teacherScope.homeroom.classGroupIds.includes(session.classGroupId)) {
      continue
    }
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}

export async function portalLessonSessionAccess(
  actor: ActorMetadata,
  lessonSessionIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  const uniqueIds = [...new Set(lessonSessionIds)]
  const lessonSessions = await repos.lessonSessions.findByIds(uniqueIds)
  if (lessonSessions.length !== uniqueIds.length) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  await dispatchClassGroupAccess(
    actor,
    [...new Set(lessonSessions.map(session => session.classGroupId))],
    repos,
  )
}

export async function staffActivitySessionAccess(
  actor: ActorMetadata,
  activitySessionIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
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

  await dispatchClassGroupAccess(actor, [...classGroupIds], repos)
}

export async function portalActivitySessionAccess(
  actor: ActorMetadata,
  activitySessionIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  const uniqueIds = [...new Set(activitySessionIds)]
  const activitySessions = await repos.activitySessions.findByIds(uniqueIds)
  if (activitySessions.length !== uniqueIds.length) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  await dispatchClassGroupAccess(
    actor,
    [...new Set(activitySessions.map(session => session.classGroupId))],
    repos,
  )
}

export async function teacherAttendanceRecordAccess(
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

export async function rosterAttendanceRecordAccess(
  actor: ActorMetadata,
  records: readonly AttendanceRecord[],
  repos: SchoolRepositories,
): Promise<void> {
  const studentIds = [...new Set(records.map(record => record.studentId))]
  const lessonSessionIds = [...new Set(records.map(record => record.lessonSessionId).filter((id): id is string => Boolean(id)))]
  const attendanceIds = [...new Set(records.map(record => record.attendanceId).filter((id): id is string => Boolean(id)))]
  const activitySessionIds = [...new Set(records.map(record => record.activitySessionId).filter((id): id is string => Boolean(id)))]

  await checkStudentAccess(actor, studentIds, repos)

  if (lessonSessionIds.length > 0) {
    await dispatchLessonSessionAccess(actor, lessonSessionIds, repos)
  }

  if (activitySessionIds.length > 0) {
    await dispatchActivitySessionAccess(actor, activitySessionIds, repos)
  }

  if (attendanceIds.length > 0) {
    const attendances = await repos.attendances.findByIds(attendanceIds)
    if (attendances.length !== attendanceIds.length) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
    const classGroupIds = [...new Set(attendances.map(attendance => attendance.classGroupId))]
    await dispatchClassGroupAccess(actor, classGroupIds, repos)
  }
}

export async function dispatchLessonSessionAccess(
  actor: ActorMetadata,
  lessonSessionIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  if (lessonSessionIds.length === 0) {
    return
  }

  switch (actor.kind) {
    case 'system':
      return
    case 'teacher':
      return teacherLessonSessionAccess(actor, lessonSessionIds, repos)
    case 'staff':
      return staffLessonSessionAccess(actor, lessonSessionIds, repos)
    case 'guardian':
    case 'student':
      return portalLessonSessionAccess(actor, lessonSessionIds, repos)
    default: {
      const _exhaustive: never = actor
      void _exhaustive
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
  }
}

export async function dispatchActivitySessionAccess(
  actor: ActorMetadata,
  activitySessionIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  if (activitySessionIds.length === 0) {
    return
  }

  switch (actor.kind) {
    case 'system':
      return
    case 'staff':
      return staffActivitySessionAccess(actor, activitySessionIds, repos)
    case 'guardian':
    case 'student':
    case 'teacher':
      return portalActivitySessionAccess(actor, activitySessionIds, repos)
    default: {
      const _exhaustive: never = actor
      void _exhaustive
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
  }
}

export async function dispatchAttendanceRecordAccess(
  actor: ActorMetadata,
  records: readonly AttendanceRecord[],
  repos: SchoolRepositories,
): Promise<void> {
  if (records.length === 0) {
    return
  }

  if (actor.kind === 'teacher') {
    return teacherAttendanceRecordAccess(actor, records, repos)
  }

  return rosterAttendanceRecordAccess(actor, records, repos)
}
