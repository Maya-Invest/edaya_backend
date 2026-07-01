import type { EntityConfigFactory } from '../../application/entities/entity-config'
import type { EntityWriteAuthorization } from '../../application/entities/managed-entity-service'
import type { ActorMetadata, AuthorizationPolicy } from '../../capabilities/authorization'
import type { StudentClassEnrollment } from '../../domain'
import type { SchoolRepositories } from '../../ports'
import { z } from 'zod'
import { dateTime, directPermissionEntityConfig, readByIds } from '../../application/entities/entity-config'
import { actorGrantCoversAny, denyResourceAccess, Permission } from '../../capabilities/authorization'
import { parseDomain, zodDate } from '../shared/utils'

export enum StudentNoteVisibility {
  Staff = 'staff',
  AdminOnly = 'admin_only',
  GuardianVisible = 'guardian_visible',
}

export enum StudentNoteCategory {
  Behavior = 'behavior',
  Work = 'work',
  Progress = 'progress',
  Encouragement = 'encouragement',
}

export const studentNoteBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  studentId: z.string().trim().min(1, 'studentId must not be blank'),
  authorStaffId: z.string().trim().min(1, 'authorStaffId must not be blank'),
  title: z.string().trim().min(1, 'title must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  category: z.nativeEnum(StudentNoteCategory).default(StudentNoteCategory.Work),
  body: z.string().trim().min(1, 'body must not be blank'),
  visibility: z.nativeEnum(StudentNoteVisibility).default(StudentNoteVisibility.Staff),
  createdAt: zodDate().default(() => new Date()),
  updatedAt: zodDate().default(() => new Date()),
})

function refineStudentNote(data: any, ctx: z.RefinementCtx) {
  if (data.updatedAt.getTime() < data.createdAt.getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'updatedAt must not be before createdAt',
    })
  }
}

export const studentNoteSchema = studentNoteBaseSchema.superRefine(refineStudentNote)

export type StudentNoteData = z.infer<typeof studentNoteSchema>
export type StudentNoteInput = z.input<typeof studentNoteSchema>

export const studentNoteCreateSchema = studentNoteBaseSchema.omit({ createdAt: true, updatedAt: true }).superRefine(refineStudentNote)
export const studentNoteUpdateSchema = studentNoteBaseSchema.partial().required({ id: true }).superRefine(refineStudentNote)

/**
 * Internal note attached to a student profile, with explicit visibility.
 */
export class StudentNote {
  readonly data: StudentNoteData

  constructor(args: StudentNoteInput) {
    this.data = parseDomain(studentNoteSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get studentId() { return this.data.studentId }
  get authorStaffId() { return this.data.authorStaffId }
  get title() { return this.data.title }
  get category() { return this.data.category }
  get body() { return this.data.body }
  get visibility() { return this.data.visibility }
  get createdAt() { return this.data.createdAt }
  get updatedAt() { return this.data.updatedAt }
}

export const studentNoteConfig: EntityConfigFactory<StudentNote> = (input) => {
  const config = directPermissionEntityConfig(
    input,
    input.repositories.studentNotes,
    Permission.QUERY_STUDENT_DETAIL_READ,
    Permission.CLASS_LOGBOOK_UPDATE,
    readByIds((actor, ids) => input.policy.checkStudentNoteAccess(actor, ids)),
  )
  return {
    ...config,
    write: {
      ...config.write,
      authorizeSave: authorizeStudentNote(input.policy),
    },
    gates: {
      preSave: validateStudentNoteSave,
    },
  }
}

function authorizeStudentNote(policy: AuthorizationPolicy): EntityWriteAuthorization<StudentNote>['authorizeSave'] {
  return async (actor, entity, existing) => {
    await policy.checkStudentAccess(actor, [entity.studentId])
    if (existing)
      await policy.checkStudentNoteAccess(actor, [existing.id])
  }
}

export async function validateStudentNoteSave(
  note: StudentNote,
  existing: StudentNote | undefined,
  repositories: SchoolRepositories,
  actor: ActorMetadata,
): Promise<void> {
  const student = await repositories.students.findById(note.studentId)
  if (!student || student.schoolId !== note.schoolId) {
    denyResourceAccess()
  }
  const staffActorId = requireStaffActorId(actor)
  if (note.visibility === StudentNoteVisibility.AdminOnly && !hasFullStudentRecordAccess(actor)) {
    denyResourceAccess()
  }
  if (existing) {
    if (existing.schoolId !== note.schoolId || existing.studentId !== note.studentId || existing.authorStaffId !== note.authorStaffId) {
      denyResourceAccess()
    }
    if (existing.authorStaffId !== staffActorId && !hasFullStudentRecordAccess(actor)) {
      denyResourceAccess()
    }
  }
}

function requireStaffActorId(actor: ActorMetadata): string {
  if (actor.kind !== 'staff') {
    denyResourceAccess()
  }
  return actor.staffMemberId
}

function hasFullStudentRecordAccess(actor: ActorMetadata): boolean {
  return actorGrantCoversAny(
    actor,
    [Permission.QUERY_STUDENT_DETAIL_READ],
    'school',
    actor.schoolId,
  )
}

export function progressionDecisionChanged(
  entity: StudentClassEnrollment,
  existing: StudentClassEnrollment,
): boolean {
  return entity.progressionDecision !== existing.progressionDecision
    || dateTime(entity.progressionDecidedAt) !== dateTime(existing.progressionDecidedAt)
    || entity.progressionDecidedBy !== existing.progressionDecidedBy
    || entity.progressionNotes !== existing.progressionNotes
}
