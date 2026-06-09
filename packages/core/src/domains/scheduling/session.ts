import type { SchoolRepositories } from '../../ports/school-repositories'
import type { EntityConfigFactory } from '../../shared'
import { Permission } from '../../authorization'
import { denyResourceAccess } from '../../authorization/authorization-error'
import { authorizeClassGroupLinked, authorizeClassGroupLinkedDelete, classGroupLinkedTenant, config, permissionAction, read, readByIds, write } from '../../shared'
import { requireNonBlank, requireOptionalNonBlank, requireValidDate } from '../utils'

export enum SessionKind {
  Course = 'course',
  Evaluation = 'evaluation',
  Event = 'event',
  Other = 'other',
}

export interface SessionArgs {
  id: string
  classGroupId: string
  title: string
  kind: SessionKind
  startsAt: Date
  endsAt: Date
  classSubjectId?: string | null
  scheduleId?: string | null
  createdAt?: Date
}

/**
 * Represents a concrete scheduled time slot where a classGroup activity actually happens.
 * Attendance is recorded against sessions.
 */
export class Session {
  readonly id: string
  readonly classGroupId: string
  readonly title: string
  readonly kind: SessionKind
  readonly startsAt: Date
  readonly endsAt: Date
  readonly classSubjectId?: string
  readonly scheduleId?: string
  readonly createdAt: Date

  constructor({
    id,
    classGroupId,
    title,
    kind,
    startsAt,
    endsAt,
    classSubjectId,
    scheduleId,
    createdAt,
  }: SessionArgs) {
    this.id = requireNonBlank(id, 'id')
    this.classGroupId = requireNonBlank(classGroupId, 'classGroupId')
    this.title = requireNonBlank(title, 'title')
    this.kind = kind
    this.startsAt = requireValidDate(startsAt, 'startsAt')
    this.endsAt = requireValidDate(endsAt, 'endsAt')
    this.classSubjectId = requireOptionalNonBlank(classSubjectId, 'classSubjectId')
    this.scheduleId = requireOptionalNonBlank(scheduleId, 'scheduleId')
    this.createdAt = createdAt ?? new Date()

    if (this.endsAt.getTime() <= this.startsAt.getTime()) {
      throw new Error('endsAt must be after startsAt')
    }
  }

  get durationMinutes(): number {
    return Math.round((this.endsAt.getTime() - this.startsAt.getTime()) / 60000)
  }

  copyWith(changes: Partial<SessionArgs>): Session {
    return new Session({
      id: this.id,
      classGroupId: this.classGroupId,
      title: this.title,
      kind: this.kind,
      startsAt: this.startsAt,
      endsAt: this.endsAt,
      classSubjectId: this.classSubjectId,
      scheduleId: this.scheduleId,
      createdAt: this.createdAt,
      ...changes,
    })
  }
}

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

async function validateSessionSave(
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
