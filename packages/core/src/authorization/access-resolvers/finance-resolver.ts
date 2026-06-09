import type { SchoolRepositories } from '../../ports/school-repositories'
import type { ActorMetadata } from '../actor-metadata'
import { AuthorizationError, AuthorizationErrorCode } from '../authorization-error'
import { Permission } from '../permissions'
import { actorGrantCoversAny } from './grant-resolver'
import { checkStudentAccess } from './student-resolver'

export async function checkFeeAccess(
  actor: ActorMetadata,
  feeIds: readonly string[],
  _repos: SchoolRepositories,
): Promise<void> {
  if (feeIds.length === 0 || actor.kind === 'system') {
    return
  }

  const hasAccess = actorGrantCoversAny(actor, [
    Permission.FINANCIAL_CONFIG_READ,
    Permission.PAYMENT_READ,
    Permission.QUERY_WORKSPACE_READ,
  ], 'school', actor.schoolId)

  if (!hasAccess) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}

export async function checkStudentFeeAccess(
  actor: ActorMetadata,
  studentFeeIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  if (studentFeeIds.length === 0 || actor.kind === 'system') {
    return
  }

  const hasStaffAccess = actorGrantCoversAny(actor, [
    Permission.PAYMENT_READ,
    Permission.PAYMENT_RECORD,
    Permission.QUERY_STUDENT_DETAIL_READ,
    Permission.QUERY_WORKSPACE_READ,
  ], 'school', actor.schoolId)

  if (hasStaffAccess) {
    return
  }

  const studentFees = await repos.studentFees.findByIds(Array.from(studentFeeIds))
  if (studentFees.length !== studentFeeIds.length) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  const studentIds = studentFees.map(sf => sf.studentId)
  await checkStudentAccess(actor, studentIds, repos)
}
