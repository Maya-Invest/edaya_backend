import type { TeacherClassGroupAccess } from '../types'
import { teacherCoversClassGroup } from '../../../capabilities/assert-teaching-capability'
import { AuthorizationError, AuthorizationErrorCode } from '../../../model/errors'

export const teacherClassGroupAccess: TeacherClassGroupAccess = async (actor, classGroupIds, repos) => {
  for (const classGroupId of classGroupIds) {
    if (!await teacherCoversClassGroup(actor, classGroupId, repos)) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
  }
}
