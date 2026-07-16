import type { AuthorizationRepositories } from '@edaya/authorization'
import type { TeacherActorScope } from '../model/actor-scope'
import { TeacherAssignmentKind, TeacherAssignmentStatus } from '@edaya/core'
import { EMPTY_TEACHER_SCOPE } from '../model/actor-scope'
import { AuthorizationError, AuthorizationErrorCode } from '../model/errors'

function isAssignmentActive(
  assignment: {
    status: TeacherAssignmentStatus
    startsAt?: Date
    endsAt?: Date
  },
  now: Date,
): boolean {
  if (assignment.status !== TeacherAssignmentStatus.Active) {
    return false
  }

  if (assignment.startsAt && assignment.startsAt > now) {
    return false
  }

  if (assignment.endsAt && assignment.endsAt <= now) {
    return false
  }

  return true
}

export async function resolveTeacherScope(args: {
  teacherId: string
  schoolId: string
  academicYearId?: string
  repositories: AuthorizationRepositories
  now?: Date
}): Promise<TeacherActorScope> {
  const teacher = await args.repositories.teachers.findById(args.teacherId)
  if (!teacher || teacher.schoolId !== args.schoolId || !teacher.isActive) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  const now = args.now ?? new Date()
  const academicYearId = args.academicYearId
    ?? (await args.repositories.academicYears.findOne({ schoolId: args.schoolId, isActive: true }))?.id

  const assignments = await args.repositories.teacherAssignments.list({
    teacherId: args.teacherId,
    ...(academicYearId ? { academicYearId } : {}),
  })

  const activeAssignments = assignments.filter(assignment => isAssignmentActive(assignment, now))
  const classSubjectIds = activeAssignments
    .filter(assignment => assignment.kind === TeacherAssignmentKind.Subject && assignment.classSubjectId)
    .map(assignment => assignment.classSubjectId!)
  const homeroomClassGroupIds = activeAssignments
    .filter(assignment => assignment.kind === TeacherAssignmentKind.Homeroom && assignment.classGroupId)
    .map(assignment => assignment.classGroupId!)

  if (classSubjectIds.length === 0 && homeroomClassGroupIds.length === 0) {
    return EMPTY_TEACHER_SCOPE
  }

  return {
    teaching: Object.freeze({
      classSubjectIds: Object.freeze([...new Set(classSubjectIds)]),
    }),
    homeroom: Object.freeze({
      classGroupIds: Object.freeze([...new Set(homeroomClassGroupIds)]),
    }),
  }
}
