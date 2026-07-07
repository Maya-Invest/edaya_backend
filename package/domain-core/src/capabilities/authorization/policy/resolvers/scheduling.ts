import type { AttendanceRecord } from '../../../../domain/scheduling/attendance-record'
import type { SchoolRepositories } from '../../../../ports/repositories/school-repositories'
import type { ActorMetadata } from '../../model/actor'
import {
  dispatchActivitySessionAccess,
  dispatchAttendanceRecordAccess,
  dispatchLessonSessionAccess,
} from '../strategies/scheduling-access'

export async function checkActivitySessionAccess(
  actor: ActorMetadata,
  activitySessionIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  await dispatchActivitySessionAccess(actor, activitySessionIds, repos)
}

export async function checkLessonSessionAccess(
  actor: ActorMetadata,
  lessonSessionIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  await dispatchLessonSessionAccess(actor, lessonSessionIds, repos)
}

export async function checkAttendanceRecordAccess(
  actor: ActorMetadata,
  records: readonly AttendanceRecord[],
  repos: SchoolRepositories,
): Promise<void> {
  await dispatchAttendanceRecordAccess(actor, records, repos)
}
