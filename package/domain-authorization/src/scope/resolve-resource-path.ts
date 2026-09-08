import type { AuthorizationRepositories } from '../ports/authorization-repositories'
import { AuthorizationError, AuthorizationErrorCode } from '../model/errors'

/** Tenant-wide permissions use an empty resource path. */
export const TENANT_WIDE_RESOURCE_PATH = ''

export function resourcePathForClassGroup(classGroupId: string): string {
  return classGroupId
}

export function resourcePathForClassSubject(
  classGroupId: string,
  classSubjectId: string,
): string {
  return `${classGroupId}:${classSubjectId}`
}

export function resourcePathForClassSubjectWildcard(classGroupId: string): string {
  return `${classGroupId}:*`
}

export function resourcePathForActivity(
  activityId: string,
  classGroupId?: string,
): string {
  return classGroupId ? `${classGroupId}:${activityId}` : activityId
}

export function resourcePathForStudent(studentId: string): string {
  return studentId
}

export async function resolveLessonSessionResourcePath(
  lessonSessionId: string,
  repositories: AuthorizationRepositories,
): Promise<string> {
  const session = await repositories.lessonSessions.findById(lessonSessionId)
  if (!session) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  return resourcePathForClassSubject(session.classGroupId, session.classSubjectId)
}

export async function resolveActivitySessionResourcePath(
  activitySessionId: string,
  repositories: AuthorizationRepositories,
): Promise<string> {
  const session = await repositories.activitySessions.findById(activitySessionId)
  if (!session) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  return resourcePathForActivity(session.activityId, session.classGroupId)
}

export async function resolveAssessmentResourcePath(
  assessmentId: string,
  repositories: AuthorizationRepositories,
): Promise<string> {
  const assessment = await repositories.assessments.findById(assessmentId)
  if (!assessment) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  return resourcePathForClassSubject(assessment.classGroupId, assessment.classSubjectId)
}
