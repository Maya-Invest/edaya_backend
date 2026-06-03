import type { SchoolRepositories } from '../../ports/school-repositories'
import type { ActorMetadata } from '../actor-metadata'
import { StaffRole } from '../../entities/school/staff-member'
import { AuthorizationError, AuthorizationErrorCode } from '../authorization-error'

const elevatedRoles = new Set([StaffRole.Admin, StaffRole.Principal])

export async function checkFeeAccess(
  actor: ActorMetadata,
  feeIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  if (feeIds.length === 0)
    return
  if (actor.kind === 'system')
    return

  if (actor.kind === 'staff') {
    const staffMember = await repos.staffMembers.findById(actor.staffMemberId)
    if (!staffMember || !staffMember.isActive || staffMember.schoolId !== actor.schoolId) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
    if (staffMember.roles.some(role => elevatedRoles.has(role) || role === StaffRole.Coordinator || role === StaffRole.Accountant)) {
      return
    }
  }

  throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
}

export async function checkStudentFeeAccess(
  actor: ActorMetadata,
  studentFeeIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  if (studentFeeIds.length === 0)
    return
  if (actor.kind === 'system')
    return

  if (actor.kind === 'student') {
    const studentFees = await repos.studentFees.findByIds(Array.from(studentFeeIds))
    const isOwner = studentFees.every(sf => sf.studentId === actor.studentId)
    if (!isOwner)
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    return
  }

  if (actor.kind === 'guardian') {
    const links = await repos.guardianLinks.list({ guardianId: actor.guardianId })
    const linkedStudentIds = new Set(links.map(l => l.studentId))
    const studentFees = await repos.studentFees.findByIds(Array.from(studentFeeIds))
    const allLinked = studentFees.every(sf => linkedStudentIds.has(sf.studentId))
    if (!allLinked)
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
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
  }

  throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
}
