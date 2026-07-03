import type { SchoolRepositories } from '../../../../ports/repositories/school-repositories'
import type { ActorMetadata } from '../../model/actor'
import { actorHasSchoolWideGrant } from '../../grants/actor-grant-checks'
import { AuthorizationError, AuthorizationErrorCode } from '../../model/errors'
import { FEE_ACCESS_PERMISSIONS, STUDENT_FEE_STAFF_ACCESS_PERMISSIONS } from './permission-sets'
import { checkStudentAccess } from './student'

export async function checkFeeAccess(
  actor: ActorMetadata,
  feeIds: readonly string[],
  _repos: SchoolRepositories,
): Promise<void> {
  if (feeIds.length === 0) {
    return
  }

  const hasAccess = actor.kind === 'staff'
    && actorHasSchoolWideGrant(actor, FEE_ACCESS_PERMISSIONS)

  if (!hasAccess) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
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
