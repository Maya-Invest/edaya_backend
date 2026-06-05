import type { SchoolRepositories } from '../../ports/school-repositories'
import type { ActorMetadata } from '../actor-metadata'
import { StudentClassEnrollmentStatus } from '../../entities/students/student-class-enrollment'
import { AuthorizationError, AuthorizationErrorCode } from '../authorization-error'
import { Permission } from '../permissions'
import { staffGrantCoversAny, staffHasAnyPermission } from './grant-resolver'

export async function checkStudentAccess(
  actor: ActorMetadata,
  studentIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  if (studentIds.length === 0)
    return
  if (actor.kind === 'system')
    return

  if (actor.kind === 'student') {
    const isSelf = studentIds.every(id => id === actor.studentId)
    if (!isSelf)
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    return
  }

  if (actor.kind === 'guardian') {
    for (const id of studentIds) {
      const link = await repos.guardianLinks.findOne({ guardianId: actor.guardianId, studentId: id })
      if (!link || link.schoolId !== actor.schoolId) {
        throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
      }
    }
    return
  }

  if (actor.kind === 'staff') {
    if (await staffHasAnyPermission(actor, [
      Permission.QUERY_STUDENT_DETAIL_READ,
      Permission.STUDENT_READ,
      Permission.STUDENT_UPDATE,
      Permission.PAYMENT_READ,
    ], repos)) {
      return
    }

    for (const studentId of studentIds) {
      const enrollments = await repos.enrollments.list({ studentId })
      const activeEnrollment = enrollments.find(e => e.status === StudentClassEnrollmentStatus.Active)
      if (!activeEnrollment) {
        throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
      }
      const canAccessClass = await staffGrantCoversAny(actor, [
        Permission.GRADE_INPUT,
        Permission.ATTENDANCE_RECORD,
        Permission.CLASS_LOGBOOK_CREATE,
        Permission.CLASS_LOGBOOK_UPDATE,
        Permission.DISCIPLINE_CREATE,
      ], 'class_group', activeEnrollment.classGroupId, repos)
      if (!canAccessClass) {
        throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
      }
    }
    return
  }

  throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
}

export async function checkGuardianAccess(
  actor: ActorMetadata,
  guardianIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  if (guardianIds.length === 0)
    return
  if (actor.kind === 'system')
    return

  if (actor.kind === 'guardian') {
    const isSelf = guardianIds.every(id => id === actor.guardianId)
    if (!isSelf)
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    return
  }

  if (actor.kind === 'staff') {
    if (await staffHasAnyPermission(actor, [
      Permission.QUERY_GUARDIAN_STUDENTS_ADMIN_READ,
      Permission.PARENT_READ,
      Permission.PARENT_UPDATE,
    ], repos)) {
      return
    }
  }

  throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
}

export async function checkStudentNoteAccess(
  actor: ActorMetadata,
  noteIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  if (noteIds.length === 0)
    return
  if (actor.kind === 'system')
    return

  if (actor.kind === 'staff') {
    if (await staffHasAnyPermission(actor, [
      Permission.QUERY_STUDENT_DETAIL_READ,
      Permission.CLASS_LOGBOOK_READ,
    ], repos)) {
      return
    }

    for (const noteId of noteIds) {
      const note = await repos.studentNotes.findById(noteId)
      if (!note)
        throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
      await checkStudentAccess(actor, [note.studentId], repos)
    }
    return
  }

  throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
}

export async function checkStudentHealthAccess(
  actor: ActorMetadata,
  profileIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  if (profileIds.length === 0)
    return
  if (actor.kind === 'system')
    return

  if (actor.kind === 'staff') {
    if (await staffHasAnyPermission(actor, [
      Permission.STUDENT_HEALTH_READ,
      Permission.STUDENT_HEALTH_UPDATE,
    ], repos)) {
      return
    }
  }

  throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
}
