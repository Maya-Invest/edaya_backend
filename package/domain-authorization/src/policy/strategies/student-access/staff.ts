import type { StaffStudentAccess } from '../types'
import {
  actorGrantCoversAny,
  actorGrantCoversAnyResourcePath,
  actorHasSchoolWideGrant,
} from '../../../grants/actor-grant-checks'
import { activeClassGroupIdsByStudent } from '../../../grants/enrollment-scope'
import { AuthorizationError, AuthorizationErrorCode } from '../../../model/errors'
import { ASSIGNMENT_SCOPED_PERMISSIONS } from '../../../permissions/assignment-scoped-permissions'
import { permissionDefinitions } from '../../../permissions/permission-definitions'
import { resourcePathForClassGroup, resourcePathForStudent } from '../../../scope/resolve-resource-path'
import { STUDENT_DIRECT_ACCESS_PERMISSIONS } from '../../resolvers/permission-sets'

const STUDENT_SCOPED_DIRECT_ACCESS_PERMISSIONS = STUDENT_DIRECT_ACCESS_PERMISSIONS.filter(
  permission => permissionDefinitions[permission].scope === 'student',
)

export const staffStudentAccess: StaffStudentAccess = async (actor, studentIds, repos) => {
  if (actorHasSchoolWideGrant(actor, STUDENT_DIRECT_ACCESS_PERMISSIONS)) {
    return
  }

  const needsEnrollmentLookup: string[] = []

  for (const studentId of studentIds) {
    const canAccessDirect = actorGrantCoversAnyResourcePath(
      actor,
      STUDENT_SCOPED_DIRECT_ACCESS_PERMISSIONS,
      resourcePathForStudent(studentId),
    ) || actorGrantCoversAny(
      actor,
      STUDENT_SCOPED_DIRECT_ACCESS_PERMISSIONS,
      'student',
      studentId,
    )

    if (canAccessDirect) {
      continue
    }

    needsEnrollmentLookup.push(studentId)
  }

  if (needsEnrollmentLookup.length === 0) {
    return
  }

  const classGroupByStudent = await activeClassGroupIdsByStudent(repos, needsEnrollmentLookup)

  for (const studentId of needsEnrollmentLookup) {
    const classGroupId = classGroupByStudent.get(studentId)
    if (!classGroupId) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }

    const canAccessClass = actorGrantCoversAnyResourcePath(
      actor,
      ASSIGNMENT_SCOPED_PERMISSIONS,
      resourcePathForClassGroup(classGroupId),
    ) || actorGrantCoversAny(
      actor,
      ASSIGNMENT_SCOPED_PERMISSIONS,
      'class_group',
      classGroupId,
    )

    if (!canAccessClass) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
  }
}
