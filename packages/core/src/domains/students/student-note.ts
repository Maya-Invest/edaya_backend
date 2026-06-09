import type { ActorMetadata, AuthorizationPolicy } from '../../authorization'
import type { StudentClassEnrollment } from '../../domains'
import type { SchoolRepositories } from '../../ports'
import type { EntityWriteAuthorization } from '../../services/managed-entity-service'
import type { EntityConfigFactory } from '../../shared'
import { AuthorizationError, denyResourceAccess, Permission, resolveEffectiveGrants, scopeGrantCovers } from '../../authorization'
import { dateTime, directPermissionEntityConfig, readByIds } from '../../shared'
import { requireNonBlank, requireOptionalNonBlank, requireValidDate } from '../utils'

export enum StudentNoteVisibility {
  Staff = 'staff',
  AdminOnly = 'admin_only',
  GuardianVisible = 'guardian_visible',
}

export interface StudentNoteArgs {
  id: string
  schoolId: string
  studentId: string
  authorStaffId: string
  body: string
  title?: string | null
  visibility?: StudentNoteVisibility
  createdAt?: Date
  updatedAt?: Date
}

/**
 * Internal note attached to a student profile, with explicit visibility.
 */
export class StudentNote {
  readonly id: string
  readonly schoolId: string
  readonly studentId: string
  readonly authorStaffId: string
  readonly title?: string
  readonly body: string
  readonly visibility: StudentNoteVisibility
  readonly createdAt: Date
  readonly updatedAt: Date

  constructor({
    id,
    schoolId,
    studentId,
    authorStaffId,
    title,
    body,
    visibility = StudentNoteVisibility.Staff,
    createdAt,
    updatedAt,
  }: StudentNoteArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.studentId = requireNonBlank(studentId, 'studentId')
    this.authorStaffId = requireNonBlank(authorStaffId, 'authorStaffId')
    this.title = requireOptionalNonBlank(title, 'title')
    this.body = requireNonBlank(body, 'body')
    this.visibility = visibility
    const now = new Date()
    this.createdAt = createdAt ? requireValidDate(createdAt, 'createdAt') : now
    this.updatedAt = updatedAt ? requireValidDate(updatedAt, 'updatedAt') : now

    if (this.updatedAt.getTime() < this.createdAt.getTime()) {
      throw new Error('updatedAt must not be before createdAt')
    }
  }
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
  if (note.visibility === StudentNoteVisibility.AdminOnly && !await hasFullStudentRecordAccess(actor, repositories)) {
    denyResourceAccess()
  }
  if (existing) {
    if (existing.schoolId !== note.schoolId || existing.studentId !== note.studentId || existing.authorStaffId !== note.authorStaffId) {
      denyResourceAccess()
    }
    if (existing.authorStaffId !== staffActorId && !await hasFullStudentRecordAccess(actor, repositories)) {
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

async function hasFullStudentRecordAccess(actor: ActorMetadata, repositories: SchoolRepositories): Promise<boolean> {
  if (actor.kind !== 'staff') {
    return false
  }

  try {
    const grants = actor.effectiveGrants ?? await resolveEffectiveGrants({
      staffMemberId: actor.staffMemberId,
      schoolId: actor.schoolId,
      repositories,
    })
    const permission = Permission.QUERY_STUDENT_DETAIL_READ
    return grants.permissions.has(permission)
      && scopeGrantCovers(grants.scopeGrants, {
        permission,
        schoolId: actor.schoolId,
        scopeType: 'school',
        scopeEntityId: actor.schoolId,
        isElevated: grants.isElevated,
      })
  }
  catch (error) {
    if (error instanceof AuthorizationError) {
      return false
    }
    throw error
  }
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
