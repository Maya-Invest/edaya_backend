import type { AuthorizationRepositories } from '@edaya/authorization'
import type { ReportCardResult } from '@edaya/core'
import type { ActorMetadata } from '../model/actor'
import { AuthorizationError, AuthorizationErrorCode } from '../model/errors'
import { guardianClassGroupAccess } from './strategies/class-group-access/guardian'
import { staffClassGroupAccess } from './strategies/class-group-access/staff'
import { studentSelfClassGroupAccess } from './strategies/class-group-access/student'
import { teacherClassGroupAccess } from './strategies/class-group-access/teacher'
import {
  guardianReportCardResultAccess,
  staffReportCardResultAccess,
  studentSelfReportCardResultAccess,
  teacherReportCardResultAccess,
} from './strategies/report-card-access'
import { guardianStudentAccess } from './strategies/student-access/guardian'
import { staffStudentAccess } from './strategies/student-access/staff'
import { studentSelfStudentAccess } from './strategies/student-access/student'
import { teacherStudentAccess } from './strategies/student-access/teacher'

export async function dispatchStudentAccess(
  actor: ActorMetadata,
  studentIds: readonly string[],
  repos: AuthorizationRepositories,
): Promise<void> {
  const uniqueStudentIds = [...new Set(studentIds)]

  switch (actor.kind) {
    case 'system':
      return
    case 'guardian':
      return guardianStudentAccess(actor, uniqueStudentIds, repos)
    case 'student':
      return studentSelfStudentAccess(actor, uniqueStudentIds, repos)
    case 'teacher':
      return teacherStudentAccess(actor, uniqueStudentIds, repos)
    case 'staff':
      return staffStudentAccess(actor, uniqueStudentIds, repos)
    default: {
      const _exhaustive: never = actor
      void _exhaustive
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
  }
}

export async function dispatchClassGroupAccess(
  actor: ActorMetadata,
  classGroupIds: readonly string[],
  repos: AuthorizationRepositories,
): Promise<void> {
  const uniqueClassGroupIds = [...new Set(classGroupIds)]

  switch (actor.kind) {
    case 'system':
      return
    case 'guardian':
      return guardianClassGroupAccess(actor, uniqueClassGroupIds, repos)
    case 'student':
      return studentSelfClassGroupAccess(actor, uniqueClassGroupIds, repos)
    case 'teacher':
      return teacherClassGroupAccess(actor, uniqueClassGroupIds, repos)
    case 'staff':
      return staffClassGroupAccess(actor, uniqueClassGroupIds, repos)
    default: {
      const _exhaustive: never = actor
      void _exhaustive
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
  }
}

export async function dispatchReportCardResultAccess(
  actor: ActorMetadata,
  results: readonly ReportCardResult[],
  repos: AuthorizationRepositories,
): Promise<void> {
  if (results.length === 0) {
    return
  }

  switch (actor.kind) {
    case 'system':
      return
    case 'staff':
      return staffReportCardResultAccess(actor, results, repos)
    case 'teacher':
      return teacherReportCardResultAccess(actor, results, repos)
    case 'guardian':
      return guardianReportCardResultAccess(actor, results, repos)
    case 'student':
      return studentSelfReportCardResultAccess(actor, results, repos)
    default: {
      const _exhaustive: never = actor
      void _exhaustive
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
  }
}
