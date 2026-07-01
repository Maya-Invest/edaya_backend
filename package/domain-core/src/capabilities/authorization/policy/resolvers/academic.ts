import type { SchoolRepositories } from '../../../../ports/repositories/school-repositories'
import type { ActorMetadata } from '../../model/actor'
import { actorGrantCoversAny } from '../../grants/actor-grant-checks'
import { AuthorizationError, AuthorizationErrorCode } from '../../model/errors'
import {
  CLASS_GROUP_ACCESS_PERMISSIONS,
  SCHOOL_WIDE_ASSESSMENT_ACCESS_PERMISSIONS,
} from '../../permissions/groups'
import { checkStudentAccess } from './student'

export async function checkClassGroupAccess(
  actor: ActorMetadata,
  classGroupIds: readonly string[],
  _repos: SchoolRepositories,
): Promise<void> {
  if (classGroupIds.length === 0) {
    return
  }

  for (const classGroupId of classGroupIds) {
    const canAccess = actorGrantCoversAny(
      actor,
      CLASS_GROUP_ACCESS_PERMISSIONS,
      'class_group',
      classGroupId,
    )

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
  if (assessmentIds.length === 0) {
    return
  }

  if (actorGrantCoversAny(
    actor,
    SCHOOL_WIDE_ASSESSMENT_ACCESS_PERMISSIONS,
    'school',
    actor.schoolId,
  )) {
    return
  }

  const assessments = await repos.assessments.findByIds([...assessmentIds])
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
  if (reportCardResultIds.length === 0) {
    return
  }

  const results = await repos.results.findByIds([...reportCardResultIds])
  const studentIds = [...new Set(results.map(result => result.studentId))]
  if (studentIds.length === 0) {
    return
  }

  await checkStudentAccess(actor, studentIds, repos)
}
