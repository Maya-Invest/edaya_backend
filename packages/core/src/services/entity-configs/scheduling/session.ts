import type { Session } from '../../../entities/scheduling/session'
import type { SchoolRepositories } from '../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../../shared'
import { Permission } from '../../../authorization'
import { denyResourceAccess } from '../../../authorization/authorization-error'
import { authorizeClassGroupLinked, authorizeClassGroupLinkedDelete, classGroupLinkedTenant, config, permissionAction, read, readByIds, write } from '../../../shared'

export const sessionConfig: EntityConfigFactory<Session> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.sessions,
    tenant: classGroupLinkedTenant('classGroupId'),
    read: read(permissionAction(policy, Permission.QUERY_TIMETABLE_READ), readByIds((actor, ids) => policy.checkSessionAccess(actor, ids))),
    write: write(permissionAction(policy, Permission.TIMETABLE_UPDATE), authorizeClassGroupLinked(policy, 'classGroupId'), authorizeClassGroupLinkedDelete(policy)),
    gates: {
      preSave: validateSessionSave,
    },
    atomicExecution,
  })

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
