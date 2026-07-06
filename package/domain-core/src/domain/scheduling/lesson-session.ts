import type { EntityConfigFactory } from '../../application/entities/entity-config'
import type { SchoolRepositories } from '../../ports/repositories/school-repositories'
import { z } from 'zod'
import { anyPermissionAction, authorizeClassGroupLinked, authorizeClassGroupLinkedDelete, classGroupLinkedTenant, config, permissionAction, read, readByIds, write } from '../../application/entities/entity-config'
import { denyResourceAccess, Permission } from '../../capabilities/authorization'
import { TIMETABLE_ACCESS_PERMISSIONS } from '../../capabilities/authorization/policy/resolvers/permission-sets'
import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'
import { dateTimeRangeDurationMinutes, refineEndsAtAfterStartsAt } from '../../domain/value-objects/date-time-range'
import { parseDomain, zodDate } from '../shared/utils'
import { OccurrenceStatus } from './occurrence-status'

export const lessonSessionBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  classGroupId: z.string().trim().min(1, 'classGroupId must not be blank'),
  scheduleId: z.string().trim().min(1, 'scheduleId must not be blank'),
  classSubjectId: z.string().trim().min(1, 'classSubjectId must not be blank'),
  status: z.nativeEnum(OccurrenceStatus).default(OccurrenceStatus.Pending),
  isException: z.boolean().default(false),
  startsAt: zodDate(),
  endsAt: zodDate(),
  displayLabel: z.string().trim().min(1, 'displayLabel must not be blank'),
  sessionNote: z.string().trim().min(1, 'sessionNote must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

function refineLessonSession(data: { startsAt?: Date, endsAt?: Date }, ctx: z.RefinementCtx) {
  if (data.startsAt && data.endsAt) {
    refineEndsAtAfterStartsAt({ startsAt: data.startsAt, endsAt: data.endsAt }, ctx)
  }
}

export const lessonSessionSchema = lessonSessionBaseSchema.superRefine(refineLessonSession)

export type LessonSessionData = z.infer<typeof lessonSessionSchema>
export type LessonSessionInput = z.input<typeof lessonSessionSchema>

export const lessonSessionCreateSchema = lessonSessionBaseSchema.omit({ createdAt: true }).superRefine(refineLessonSession)
export const lessonSessionUpdateSchema = lessonSessionBaseSchema.partial().required({ id: true }).superRefine(refineLessonSession)

/**
 * Materialized lesson occurrence — one row per school day matching a lesson schedule.
 * Replaces generic Session for lessons and serves as the logbook anchor.
 */
export class LessonSession {
  readonly data: LessonSessionData

  constructor(args: LessonSessionInput) {
    this.data = parseDomain(lessonSessionSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get classGroupId() { return this.data.classGroupId }
  get scheduleId() { return this.data.scheduleId }
  get classSubjectId() { return this.data.classSubjectId }
  get status() { return this.data.status }
  get isException() { return this.data.isException }
  get startsAt() { return this.data.startsAt }
  get endsAt() { return this.data.endsAt }
  get displayLabel() { return this.data.displayLabel }
  get sessionNote() { return this.data.sessionNote }
  get createdAt() { return this.data.createdAt }

  get durationMinutes(): number {
    return dateTimeRangeDurationMinutes(this.startsAt, this.endsAt)
  }

  get isResyncEligible(): boolean {
    return this.status === OccurrenceStatus.Pending && !this.isException
  }

  copyWith(changes: Partial<LessonSessionInput>): LessonSession {
    return new LessonSession({
      id: this.id,
      schoolId: this.schoolId,
      classGroupId: this.classGroupId,
      scheduleId: this.scheduleId,
      classSubjectId: this.classSubjectId,
      status: this.status,
      isException: this.isException,
      startsAt: this.startsAt,
      endsAt: this.endsAt,
      displayLabel: this.displayLabel,
      sessionNote: this.sessionNote,
      createdAt: this.createdAt,
      ...changes,
    })
  }
}

export const lessonSessionConfig: EntityConfigFactory<LessonSession> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.lessonSessions,
    tenant: classGroupLinkedTenant('classGroupId'),
    read: read(
      anyPermissionAction([...TIMETABLE_ACCESS_PERMISSIONS]),
      readByIds((actor, ids) => policy.checkLessonSessionAccess(actor, ids)),
    ),
    write: write(permissionAction(Permission.TIMETABLE_UPDATE), authorizeClassGroupLinked(policy, 'classGroupId'), authorizeClassGroupLinkedDelete(policy)),
    gates: {
      preSave: validateLessonSessionSave,
    },
    atomicExecution,
  })

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
