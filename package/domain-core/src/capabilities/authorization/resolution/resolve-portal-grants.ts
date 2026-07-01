import type { SchoolRepositories } from '../../../ports/repositories/school-repositories'
import type { EffectiveGrants } from '../model/effective-grants'
import { uniqueActiveClassGroupIds } from '../grants/enrollment-scope'
import { GUARDIAN_PORTAL_PERMISSIONS, STUDENT_PORTAL_PERMISSIONS } from '../grants/portal-permission-sets'
import { buildPortalScopeGrants } from '../grants/portal-scope-grants'
import { AuthorizationError, AuthorizationErrorCode } from '../model/errors'

export async function resolveGuardianGrants(args: {
  guardianId: string
  schoolId: string
  repositories: SchoolRepositories
}): Promise<EffectiveGrants> {
  const guardian = await args.repositories.guardians.findById(args.guardianId)
  if (!guardian || guardian.schoolId !== args.schoolId) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  const links = await args.repositories.guardianLinks.list({ guardianId: args.guardianId })
  const studentIds = links.filter(l => l.schoolId === args.schoolId).map(l => l.studentId)
  const classGroupIds = await uniqueActiveClassGroupIds(args.repositories, studentIds)

  return {
    permissions: GUARDIAN_PORTAL_PERMISSIONS,
    scopeGrants: buildPortalScopeGrants(GUARDIAN_PORTAL_PERMISSIONS, { studentIds, classGroupIds }),
    isElevated: false,
  }
}

export async function resolveStudentGrants(args: {
  studentId: string
  schoolId: string
  repositories: SchoolRepositories
}): Promise<EffectiveGrants> {
  const student = await args.repositories.students.findById(args.studentId)
  if (!student || student.schoolId !== args.schoolId) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  const [activeClassGroupId] = await uniqueActiveClassGroupIds(args.repositories, [args.studentId])

  return {
    permissions: STUDENT_PORTAL_PERMISSIONS,
    scopeGrants: buildPortalScopeGrants(STUDENT_PORTAL_PERMISSIONS, {
      studentIds: [args.studentId],
      ...(activeClassGroupId ? { classGroupIds: [activeClassGroupId] } : {}),
    }),
    isElevated: false,
  }
}
