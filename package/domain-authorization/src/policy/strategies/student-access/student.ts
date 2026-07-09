import type { StudentSelfStudentAccess } from '../types'
import { studentScopeCoversSelf } from '../../../capabilities/assert-student-capability'
import { AuthorizationError, AuthorizationErrorCode } from '../../../model/errors'

export const studentSelfStudentAccess: StudentSelfStudentAccess = async (actor, studentIds) => {
  for (const studentId of studentIds) {
    if (!studentScopeCoversSelf(actor, studentId)) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
  }
}
