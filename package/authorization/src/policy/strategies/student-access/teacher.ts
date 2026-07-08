import type { TeacherStudentAccess } from '../types'
import { teacherCoversClassGroup } from '../../../capabilities/assert-teaching-capability'
import { activeClassGroupIdsByStudent } from '../../../grants/enrollment-scope'
import { AuthorizationError, AuthorizationErrorCode } from '../../../model/errors'

export const teacherStudentAccess: TeacherStudentAccess = async (actor, studentIds, repos) => {
  const classGroupByStudent = await activeClassGroupIdsByStudent(repos, studentIds)
  for (const studentId of studentIds) {
    const classGroupId = classGroupByStudent.get(studentId)
    if (!classGroupId || !await teacherCoversClassGroup(actor, classGroupId, repos)) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
  }
}
