import type { SchoolRepositories } from '../../ports/school-repositories'
import type { EntityConfigFactory } from '../../shared'
import { z } from 'zod'
import { denyResourceAccess, Permission } from '../../authorization'
import { authorizeClassGroupLinked, authorizeClassGroupLinkedDelete, classGroupLinkedTenant, config, permissionAction, read, readByIds, write } from '../../shared'
import { parseDomain, zodDate } from '../utils'

export enum SessionKind {
  Course = 'course',
  Evaluation = 'evaluation',
  Event = 'event',
  Other = 'other',
}

export const sessionBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  classGroupId: z.string().trim().min(1, 'classGroupId must not be blank'),
  title: z.string().trim().min(1, 'title must not be blank'),
  kind: z.nativeEnum(SessionKind),
  startsAt: zodDate(),
  endsAt: zodDate(),
  classSubjectId: z.string().trim().min(1, 'classSubjectId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  scheduleId: z.string().trim().min(1, 'scheduleId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

function refineSession(data: any, ctx: z.RefinementCtx) {
  if (data.endsAt.getTime() <= data.startsAt.getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'endsAt must be after startsAt',
    })
  }
}

export const sessionSchema = sessionBaseSchema.superRefine(refineSession)

export type SessionData = z.infer<typeof sessionSchema>
export type SessionInput = z.input<typeof sessionSchema>

export const sessionCreateSchema = sessionBaseSchema.omit({ createdAt: true }).superRefine(refineSession)
export const sessionUpdateSchema = sessionBaseSchema.partial().required({ id: true }).superRefine(refineSession)

/**
 * Represents a concrete scheduled time slot where a classGroup activity actually happens.
 * Attendance is recorded against sessions.
 */
export class Session {
  readonly data: SessionData

  constructor(args: SessionInput) {
    this.data = parseDomain(sessionSchema, args)
  }

  get id() { return this.data.id }
  get classGroupId() { return this.data.classGroupId }
  get title() { return this.data.title }
  get kind() { return this.data.kind }
  get startsAt() { return this.data.startsAt }
  get endsAt() { return this.data.endsAt }
  get classSubjectId() { return this.data.classSubjectId }
  get scheduleId() { return this.data.scheduleId }
  get createdAt() { return this.data.createdAt }

  get durationMinutes(): number {
    return Math.round((this.endsAt.getTime() - this.startsAt.getTime()) / 60000)
  }

  copyWith(changes: Partial<SessionInput>): Session {
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
    read: read(permissionAction(Permission.QUERY_TIMETABLE_READ), readByIds((actor, ids) => policy.checkSessionAccess(actor, ids))),
    write: write(permissionAction(Permission.TIMETABLE_UPDATE), authorizeClassGroupLinked(policy, 'classGroupId'), authorizeClassGroupLinkedDelete(policy)),
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
