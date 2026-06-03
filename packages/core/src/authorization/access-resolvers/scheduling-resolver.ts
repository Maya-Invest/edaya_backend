import type { SchoolRepositories } from '../../ports/school-repositories'
import type { ActorMetadata } from '../actor-metadata'
import { StaffRole } from '../../entities/school/staff-member'
import { StudentClassEnrollmentStatus } from '../../entities/students/student-class-enrollment'
import { AuthorizationError, AuthorizationErrorCode } from '../authorization-error'

const elevatedRoles = new Set([StaffRole.Admin, StaffRole.Principal])

export async function checkSessionAccess(
  actor: ActorMetadata,
  sessionIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  if (sessionIds.length === 0)
    return
  if (actor.kind === 'system')
    return

  if (actor.kind === 'student' || actor.kind === 'guardian') {
    const classGroupIds = new Set<string>()
    for (const sessionId of sessionIds) {
      const session = await repos.sessions.findById(sessionId)
      if (!session)
        throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
      classGroupIds.add(session.classGroupId)
    }
    await checkClassGroupAccess(actor, Array.from(classGroupIds), repos)
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

    if (staffMember.roles.includes(StaffRole.Teacher)) {
      for (const sessionId of sessionIds) {
        const session = await repos.sessions.findById(sessionId)
        if (!session)
          throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
        const assignments = await repos.staffAssignments.list({ classGroupId: session.classGroupId, staffId: actor.staffMemberId })
        if (assignments.length === 0) {
          throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
        }
      }
      return
    }
  }

  throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
}

export async function checkAttendanceAccess(
  actor: ActorMetadata,
  studentIds: readonly string[],
  sessionIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  await Promise.all([
    checkStudentAccess(actor, studentIds, repos),
    checkSessionAccess(actor, sessionIds, repos),
  ])
}

// Inline fallback helpers
async function checkClassGroupAccess(
  actor: ActorMetadata,
  classGroupIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  if (actor.kind === 'student') {
    const enrollments = await repos.enrollments.list({ studentId: actor.studentId, status: StudentClassEnrollmentStatus.Active })
    const activeClassGroupIds = new Set(enrollments.map(e => e.classGroupId))
    const isEnrolled = classGroupIds.every(id => activeClassGroupIds.has(id))
    if (!isEnrolled)
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    return
  }

  if (actor.kind === 'guardian') {
    const links = await repos.guardianLinks.list({ guardianId: actor.guardianId })
    const studentIds = links.map(link => link.studentId)
    const activeClassGroups = new Set<string>()
    for (const studentId of studentIds) {
      const enrollments = await repos.enrollments.list({ studentId, status: StudentClassEnrollmentStatus.Active })
      enrollments.forEach(e => activeClassGroups.add(e.classGroupId))
    }
    const allLinked = classGroupIds.every(id => activeClassGroups.has(id))
    if (!allLinked)
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

    if (staffMember.roles.includes(StaffRole.Teacher)) {
      for (const classGroupId of classGroupIds) {
        const assignments = await repos.staffAssignments.list({ classGroupId, staffId: actor.staffMemberId })
        if (assignments.length === 0) {
          throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
        }
      }
      return
    }
  }

  throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
}

async function checkStudentAccess(
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

    if (staffMember.roles.some(role => elevatedRoles.has(role) || role === StaffRole.Coordinator)) {
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
