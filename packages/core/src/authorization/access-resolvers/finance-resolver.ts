import type { SchoolRepositories } from '../../ports/school-repositories'
import type { ActorMetadata } from '../actor-metadata'
import { AuthorizationError, AuthorizationErrorCode } from '../authorization-error'
import { Permission } from '../permissions'
import { staffHasAnyPermission } from './grant-resolver'

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
    if (await staffHasAnyPermission(actor, [
      Permission.FINANCIAL_CONFIG_READ,
      Permission.PAYMENT_READ,
      Permission.QUERY_WORKSPACE_READ,
    ], repos)) {
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
    if (await staffHasAnyPermission(actor, [
      Permission.PAYMENT_READ,
      Permission.PAYMENT_RECORD,
      Permission.QUERY_STUDENT_DETAIL_READ,
      Permission.QUERY_WORKSPACE_READ,
    ], repos)) {
      return
    }
  }

  throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
}
