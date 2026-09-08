import type { GuardianScope, StudentScope } from '../model/actor-scope'
import type { AuthorizationRepositories } from '../ports/authorization-repositories'
import { uniqueActiveClassGroupIds } from '../grants/enrollment-scope'
import { AuthorizationError, AuthorizationErrorCode } from '../model/errors'

export async function resolveGuardianScope(args: {
  guardianId: string
  schoolId: string
  repositories: AuthorizationRepositories
}): Promise<GuardianScope> {
  const guardian = await args.repositories.guardians.findById(args.guardianId)
  if (!guardian || guardian.schoolId !== args.schoolId) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  const links = await args.repositories.guardianLinks.list({ guardianId: args.guardianId })
  const studentIds = links.filter(link => link.schoolId === args.schoolId).map(link => link.studentId)
  const classGroupIds = await uniqueActiveClassGroupIds(args.repositories, studentIds)

  return {
    studentIds,
    classGroupIds,
  }
}

export async function resolveStudentScope(args: {
  studentId: string
  schoolId: string
  repositories: AuthorizationRepositories
}): Promise<StudentScope> {
  const student = await args.repositories.students.findById(args.studentId)
  if (!student || student.schoolId !== args.schoolId) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  const [activeClassGroupId] = await uniqueActiveClassGroupIds(args.repositories, [args.studentId])

  return {
    studentId: args.studentId,
    ...(activeClassGroupId ? { classGroupId: activeClassGroupId } : {}),
  }
}
