import type { SchoolRepositories } from '../../../../ports/repositories/school-repositories'
import type { ActorMetadata } from '../../model/actor'
import { actorHasSchoolWideGrant } from '../../grants/actor-grant-checks'
import { AuthorizationError, AuthorizationErrorCode } from '../../model/errors'
import { dispatchFeeAccess } from '../strategies/fee-access'
import { STUDENT_FEE_STAFF_ACCESS_PERMISSIONS } from './permission-sets'
import { checkStudentAccess } from './student'

export async function checkFeeAccess(
  actor: ActorMetadata,
  feeIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  await dispatchFeeAccess(actor, feeIds, repos)
}

export async function checkStudentFeeAccess(
  actor: ActorMetadata,
  studentFeeIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  if (studentFeeIds.length === 0) {
    return
  }

  const hasStaffAccess = actor.kind === 'staff'
    && actorHasSchoolWideGrant(actor, STUDENT_FEE_STAFF_ACCESS_PERMISSIONS)

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
