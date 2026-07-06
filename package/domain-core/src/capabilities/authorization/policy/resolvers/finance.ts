import type { SchoolRepositories } from '../../../../ports/repositories/school-repositories'
import type { ActorMetadata } from '../../model/actor'
import { actorHasSchoolWideGrant } from '../../grants/actor-grant-checks'
import { AuthorizationError, AuthorizationErrorCode } from '../../model/errors'
import { FEE_ACCESS_PERMISSIONS, STUDENT_FEE_STAFF_ACCESS_PERMISSIONS } from './permission-sets'
import { checkStudentAccess } from './student'

function isPortalActor(actor: ActorMetadata): boolean {
  return actor.kind === 'guardian' || actor.kind === 'student' || actor.kind === 'teacher'
}

export async function checkFeeAccess(
  actor: ActorMetadata,
  feeIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  if (feeIds.length === 0) {
    return
  }

  if (actor.kind === 'staff' && actorHasSchoolWideGrant(actor, FEE_ACCESS_PERMISSIONS)) {
    return
  }

  if (isPortalActor(actor)) {
    await checkPortalFeeCatalogAccess(actor, feeIds, repos)
    return
  }

  throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
}

async function checkPortalFeeCatalogAccess(
  actor: ActorMetadata,
  feeIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  const uniqueFeeIds = [...new Set(feeIds)]

  for (const feeId of uniqueFeeIds) {
    const linkedStudentFees = await repos.studentFees.list({ feeId })
    if (linkedStudentFees.length === 0) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }

    let canAccessFeeCatalog = false
    for (const studentFee of linkedStudentFees) {
      try {
        await checkStudentFeeAccess(actor, [studentFee.id], repos)
        canAccessFeeCatalog = true
        break
      }
      catch (error) {
        if (!(error instanceof AuthorizationError)) {
          throw error
        }
      }
    }

    if (!canAccessFeeCatalog) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
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
