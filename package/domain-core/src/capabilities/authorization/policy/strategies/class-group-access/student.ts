import type { StudentSelfClassGroupAccess } from '../types'
import { studentScopeCoversClassGroup } from '../../../capabilities/assert-student-capability'
import { AuthorizationError, AuthorizationErrorCode } from '../../../model/errors'

export const studentSelfClassGroupAccess: StudentSelfClassGroupAccess = async (actor, classGroupIds) => {
  for (const classGroupId of classGroupIds) {
    if (!studentScopeCoversClassGroup(actor, classGroupId)) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
  }
}
