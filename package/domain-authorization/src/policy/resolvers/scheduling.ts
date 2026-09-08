import type { AttendanceRecord } from '@edaya/core'
import type { ActorMetadata } from '../../model/actor'
import type { AuthorizationRepositories } from '../../ports/authorization-repositories'
import {
  dispatchActivitySessionAccess,
  dispatchAttendanceRecordAccess,
  dispatchLessonSessionAccess,
  dispatchLessonSessionReadAccess,
} from '../strategies/scheduling-access'

export async function checkActivitySessionAccess(
  actor: ActorMetadata,
  activitySessionIds: readonly string[],
  repos: AuthorizationRepositories,
): Promise<void> {
  await dispatchActivitySessionAccess(actor, activitySessionIds, repos)
}

export async function checkLessonSessionReadAccess(
  actor: ActorMetadata,
  lessonSessionIds: readonly string[],
  repos: AuthorizationRepositories,
): Promise<void> {
  await dispatchLessonSessionReadAccess(actor, lessonSessionIds, repos)
}

export async function checkLessonSessionAccess(
  actor: ActorMetadata,
  lessonSessionIds: readonly string[],
  repos: AuthorizationRepositories,
): Promise<void> {
  await dispatchLessonSessionAccess(actor, lessonSessionIds, repos)
}

export async function checkAttendanceRecordAccess(
  actor: ActorMetadata,
  records: readonly AttendanceRecord[],
  repos: AuthorizationRepositories,
): Promise<void> {
  await dispatchAttendanceRecordAccess(actor, records, repos)
}
