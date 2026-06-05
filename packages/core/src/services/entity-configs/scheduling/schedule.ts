import type { Schedule } from '../../../entities/scheduling/schedule'
import type { Session } from '../../../entities/scheduling/session'
import type { SchoolRepositories } from '../../../ports'
import type { EntityConfigFactory } from '../../../shared'
import { Permission } from '../../../authorization'
import { denyResourceAccess } from '../../../authorization/authorization-error'
import { authorizeClassGroupLinked, authorizeClassGroupLinkedDelete, classGroupLinkedTenant, config, noopReadAccess, permissionAction, read, write } from '../../../shared'

export const scheduleConfig: EntityConfigFactory<Schedule> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.schedules,
    tenant: classGroupLinkedTenant('classGroupId'),
    read: read(permissionAction(policy, Permission.QUERY_TIMETABLE_READ), noopReadAccess),
    write: write(permissionAction(policy, Permission.TIMETABLE_UPDATE), authorizeClassGroupLinked(policy, 'classGroupId'), authorizeClassGroupLinkedDelete(policy)),
    gates: {
      preSave: validateScheduleSave,
    },
    atomicExecution,
  })

export async function validateScheduleSave(
  schedule: Schedule,
  _existing: Schedule | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  await requireValidClassSubject(schedule.classSubjectId, schedule.classGroupId, repositories)
}

export async function validateSessionSave(
  session: Session,
  _existing: Session | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  await requireValidClassSubject(session.classSubjectId, session.classGroupId, repositories)
}

async function requireValidClassSubject(
  classSubjectId: string | undefined,
  classGroupId: string,
  repositories: SchoolRepositories,
): Promise<void> {
  if (!classSubjectId) {
    return
  }
  if (!repositories.classSubjects) {
    return
  }
  const classSubject = await repositories.classSubjects.findById(classSubjectId)
  if (!classSubject || classSubject.classGroupId !== classGroupId) {
    denyResourceAccess()
  }
}
