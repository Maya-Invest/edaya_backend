import type { SchoolRepositories } from '../../ports/school-repositories'
import type { ActorMetadata } from '../actor-metadata'
import { StaffRole } from '../../entities/school/staff-member'
import { StudentClassEnrollmentStatus } from '../../entities/students/student-class-enrollment'
import { AuthorizationError, AuthorizationErrorCode } from '../authorization-error'

const elevatedRoles = new Set([StaffRole.Admin, StaffRole.Principal])

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
    const staffMember = await repos.staffMembers.findById(actor.staffMemberId)
    if (!staffMember || !staffMember.isActive || staffMember.schoolId !== actor.schoolId) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }

    if (staffMember.roles.some(role => elevatedRoles.has(role) || role === StaffRole.Coordinator || role === StaffRole.Accountant)) {
      return
    }

    if (staffMember.roles.includes(StaffRole.Teacher)) {
      for (const studentId of studentIds) {
        const enrollments = await repos.enrollments.list({ studentId })
        const activeEnrollment = enrollments.find(e => e.status === StudentClassEnrollmentStatus.Active)
        if (!activeEnrollment) {
          throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
        }
        const assignments = await repos.staffAssignments.list({ classGroupId: activeEnrollment.classGroupId })
        const isAssigned = assignments.some(a => a.staffId === actor.staffMemberId)
        if (!isAssigned) {
          throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
        }
      }
      return
    }
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
    const staffMember = await repos.staffMembers.findById(actor.staffMemberId)
    if (!staffMember || !staffMember.isActive || staffMember.schoolId !== actor.schoolId) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
    if (staffMember.roles.some(role => elevatedRoles.has(role) || role === StaffRole.Coordinator)) {
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
    const staffMember = await repos.staffMembers.findById(actor.staffMemberId)
    if (!staffMember || !staffMember.isActive || staffMember.schoolId !== actor.schoolId) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
    if (staffMember.roles.some(role => elevatedRoles.has(role) || role === StaffRole.Coordinator)) {
      return
    }

    if (staffMember.roles.includes(StaffRole.Teacher)) {
      for (const noteId of noteIds) {
        const note = await repos.studentNotes.findById(noteId)
        if (!note)
          throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
        await checkStudentAccess(actor, [note.studentId], repos)
      }
      return
    }
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
    const staffMember = await repos.staffMembers.findById(actor.staffMemberId)
    if (!staffMember || !staffMember.isActive || staffMember.schoolId !== actor.schoolId) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
    if (staffMember.roles.some(role => elevatedRoles.has(role) || role === StaffRole.Coordinator)) {
      return
    }
  }

  throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
}
