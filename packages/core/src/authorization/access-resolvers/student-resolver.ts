import type { SchoolRepositories } from '../../ports/school-repositories'
import type { ActorMetadata } from '../actor-metadata'
import { StudentClassEnrollmentStatus } from '../../domains'
import { AuthorizationError, AuthorizationErrorCode } from '../authorization-error'
import { Permission } from '../permissions'
import { actorGrantCoversAny, actorHasAnyPermission } from './grant-resolver'

export async function checkStudentAccess(
  actor: ActorMetadata,
  studentIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  if (studentIds.length === 0 || actor.kind === 'system') {
    return
  }

  for (const studentId of studentIds) {
    // 1. Direct student-level access (e.g. self student, guardian child, or staff with student scope grant)
    const canAccessDirect = actorGrantCoversAny(actor, [
      Permission.QUERY_STUDENT_DETAIL_READ,
      Permission.STUDENT_READ,
      Permission.STUDENT_UPDATE,
      Permission.PAYMENT_READ,
    ], 'student', studentId)

    if (canAccessDirect) {
      continue
    }

    // 2. Fallback: Check if actor has class-group scoped permissions that cover the student's active enrollment class group
    const enrollments = await repos.enrollments.list({ studentId })
    const activeEnrollment = enrollments.find(e => e.status === StudentClassEnrollmentStatus.Active)
    if (!activeEnrollment) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }

    const canAccessClass = actorGrantCoversAny(actor, [
      Permission.GRADE_INPUT,
      Permission.ATTENDANCE_RECORD,
      Permission.CLASS_LOGBOOK_CREATE,
      Permission.CLASS_LOGBOOK_UPDATE,
      Permission.DISCIPLINE_CREATE,
    ], 'class_group', activeEnrollment.classGroupId)

    if (!canAccessClass) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
  }
}

export async function checkGuardianAccess(
  actor: ActorMetadata,
  guardianIds: readonly string[],
  _repos: SchoolRepositories,
): Promise<void> {
  if (guardianIds.length === 0 || actor.kind === 'system') {
    return
  }

  for (const guardianId of guardianIds) {
    const isSelf = actor.kind === 'guardian' && actor.actorId === guardianId
    if (isSelf) {
      continue
    }

    const hasStaffPermission = actorGrantCoversAny(actor, [
      Permission.QUERY_GUARDIAN_STUDENTS_ADMIN_READ,
      Permission.PARENT_READ,
      Permission.PARENT_UPDATE,
    ], 'school', actor.schoolId)

    if (!hasStaffPermission) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
  }
}

export async function checkStudentNoteAccess(
  actor: ActorMetadata,
  noteIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  if (noteIds.length === 0 || actor.kind === 'system') {
    return
  }

  if (actor.kind !== 'staff') {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  const hasGeneral = actorGrantCoversAny(actor, [
    Permission.QUERY_STUDENT_DETAIL_READ,
    Permission.CLASS_LOGBOOK_READ,
  ], 'school', actor.schoolId)

  if (hasGeneral) {
    return
  }

  for (const noteId of noteIds) {
    const note = await repos.studentNotes.findById(noteId)
    if (!note) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
    await checkStudentAccess(actor, [note.studentId], repos)
  }
}

export async function checkStudentHealthAccess(
  actor: ActorMetadata,
  profileIds: readonly string[],
  _repos: SchoolRepositories,
): Promise<void> {
  if (profileIds.length === 0 || actor.kind === 'system') {
    return
  }

  const hasAccess = actorHasAnyPermission(actor, [
    Permission.STUDENT_HEALTH_READ,
    Permission.STUDENT_HEALTH_UPDATE,
  ])

  if (!hasAccess) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}
