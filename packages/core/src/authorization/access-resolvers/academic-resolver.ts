import type { SchoolRepositories } from '../../ports/school-repositories'
import type { ActorMetadata } from '../actor-metadata'
import { AuthorizationError, AuthorizationErrorCode } from '../authorization-error'
import { Permission } from '../permissions'
import { actorGrantCoversAny } from './grant-resolver'
import { checkStudentAccess } from './student-resolver'

export async function checkClassGroupAccess(
  actor: ActorMetadata,
  classGroupIds: readonly string[],
  _repos: SchoolRepositories,
): Promise<void> {
  if (classGroupIds.length === 0 || actor.kind === 'system') {
    return
  }

  for (const classGroupId of classGroupIds) {
    const canAccess = actorGrantCoversAny(actor, [
      Permission.ACADEMIC_PROGRAM_READ,
      Permission.ACADEMIC_PROGRAM_UPDATE,
      Permission.QUERY_CLASS_DIRECTORY_READ,
      Permission.GRADE_INPUT,
      Permission.ATTENDANCE_RECORD,
      Permission.CLASS_LOGBOOK_CREATE,
      Permission.CLASS_LOGBOOK_UPDATE,
      Permission.DISCIPLINE_CREATE,
      Permission.GRADE_READ,
      Permission.CLASS_LOGBOOK_READ,
      Permission.ATTENDANCE_READ,
    ], 'class_group', classGroupId)

    if (!canAccess) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
  }
}

export async function checkAssessmentAccess(
  actor: ActorMetadata,
  assessmentIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  if (assessmentIds.length === 0 || actor.kind === 'system') {
    return
  }

  if (actorGrantCoversAny(actor, [
    Permission.GRADE_READ,
    Permission.EXAM_CONFIG_CONFIGURE,
    Permission.QUERY_CURRICULUM_PROGRESS_READ,
  ], 'school', actor.schoolId)) {
    return
  }

  const assessments = await repos.assessments.findByIds(Array.from(assessmentIds))
  if (assessments.length !== assessmentIds.length) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  const classGroupIds = [...new Set(assessments.map(a => a.classGroupId))]
  await checkClassGroupAccess(actor, classGroupIds, repos)
}

export async function checkReportCardResultAccess(
  actor: ActorMetadata,
  reportCardResultIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  if (reportCardResultIds.length === 0 || actor.kind === 'system') {
    return
  }

  for (const resultId of reportCardResultIds) {
    const result = await repos.results.findById(resultId)
    if (!result) {
      continue
    }
    await checkStudentAccess(actor, [result.studentId], repos)
  }
}
