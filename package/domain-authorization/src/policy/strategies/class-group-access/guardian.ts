import type { GuardianClassGroupAccess } from '../types'
import { guardianScopeCoversClassGroup } from '../../../capabilities/assert-guardian-capability'
import { AuthorizationError, AuthorizationErrorCode } from '../../../model/errors'

export const guardianClassGroupAccess: GuardianClassGroupAccess = async (actor, classGroupIds) => {
  for (const classGroupId of classGroupIds) {
    if (!guardianScopeCoversClassGroup(actor, classGroupId)) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
  }
}
