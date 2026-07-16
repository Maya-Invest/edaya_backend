import type { GuardianStudentAccess } from '../types'
import { guardianScopeCoversStudent } from '../../../capabilities/assert-guardian-capability'
import { AuthorizationError, AuthorizationErrorCode } from '../../../model/errors'

export const guardianStudentAccess: GuardianStudentAccess = async (actor, studentIds) => {
  for (const studentId of studentIds) {
    if (!guardianScopeCoversStudent(actor, studentId)) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
  }
}
