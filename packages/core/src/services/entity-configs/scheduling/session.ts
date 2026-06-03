import type { Session } from '../../../entities/scheduling/session'
import type { SchoolRepositories } from '../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../../shared/common'
import { denyResourceAccess } from '../../../authorization/authorization-error'
import { action, authorizeClassGroupLinked, authorizeClassGroupLinkedDelete, classGroupLinkedTenant, config, read, readByIds, write } from '../../../shared/common'

export const sessionConfig: EntityConfigFactory<Session> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.sessions,
    tenant: classGroupLinkedTenant('classGroupId'),
    read: read(action(policy, 'queries.read_timetable'), readByIds((actor, ids) => policy.checkSessionAccess(actor, ids))),
    write: write(action(policy, 'scheduling.manage'), authorizeClassGroupLinked(policy, 'classGroupId'), authorizeClassGroupLinkedDelete(policy)),
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
