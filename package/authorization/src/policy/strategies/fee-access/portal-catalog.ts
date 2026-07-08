import type { AuthorizationRepositories } from '@edaya/authorization'
import type { ActorMetadata } from '../../../model/actor'
import { AuthorizationError, AuthorizationErrorCode } from '../../../model/errors'
import { checkStudentAccess } from '../../resolvers/student'

export async function portalFeeCatalogAccess(
  actor: ActorMetadata,
  feeIds: readonly string[],
  repos: AuthorizationRepositories,
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
        await checkStudentAccess(actor, [studentFee.studentId], repos)
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
