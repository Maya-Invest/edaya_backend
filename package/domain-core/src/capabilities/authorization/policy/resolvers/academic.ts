import type { SchoolRepositories } from '../../../../ports/repositories/school-repositories'
import type { ActorMetadata } from '../../model/actor'
import {
  assertTeacherCanReadReportCard,
} from '../../../../domain/assessments/report-card-comment-access'
import {
  guardianScopeCoversClassGroup,
} from '../../capabilities/assert-guardian-capability'
import {
  studentScopeCoversClassGroup,
} from '../../capabilities/assert-student-capability'
import {
  teacherCoversClassGroup,
  teacherScopeCoversClassSubject,
} from '../../capabilities/assert-teaching-capability'
import {
  actorGrantCoversAny,
  actorGrantCoversAnyResourcePath,
  actorHasSchoolWideGrant,
} from '../../grants/actor-grant-checks'
import { AuthorizationError, AuthorizationErrorCode } from '../../model/errors'
import {
  resourcePathForClassGroup,
  resourcePathForClassSubject,
} from '../../scope/resolve-resource-path'
import {
  CLASS_GROUP_ACCESS_PERMISSIONS,
  SCHOOL_WIDE_ASSESSMENT_ACCESS_PERMISSIONS,
} from './permission-sets'
import { checkStudentAccess } from './student'

export async function checkClassGroupAccess(
  actor: ActorMetadata,
  classGroupIds: readonly string[],
  _repos: SchoolRepositories,
): Promise<void> {
  if (classGroupIds.length === 0) {
    return
  }

  if (actor.kind === 'guardian') {
    for (const classGroupId of classGroupIds) {
      if (!guardianScopeCoversClassGroup(actor, classGroupId)) {
        throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
      }
    }
    return
  }

  if (actor.kind === 'student') {
    for (const classGroupId of classGroupIds) {
      if (!studentScopeCoversClassGroup(actor, classGroupId)) {
        throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
      }
    }
    return
  }

  if (actor.kind === 'teacher') {
    for (const classGroupId of classGroupIds) {
      if (!await teacherCoversClassGroup(actor, classGroupId, _repos)) {
        throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
      }
    }
    return
  }

  for (const classGroupId of classGroupIds) {
    const canAccess = actorGrantCoversAnyResourcePath(
      actor,
      CLASS_GROUP_ACCESS_PERMISSIONS,
      resourcePathForClassGroup(classGroupId),
    ) || actorGrantCoversAny(
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

  if (actor.kind === 'guardian' || actor.kind === 'student') {
    const assessments = await repos.assessments.findByIds([...assessmentIds])
    if (assessments.length !== assessmentIds.length) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }

    await checkClassGroupAccess(
      actor,
      [...new Set(assessments.map(assessment => assessment.classGroupId))],
      repos,
    )
    return
  }

  if (actor.kind === 'teacher') {
    const assessments = await repos.assessments.findByIds([...assessmentIds])
    if (assessments.length !== assessmentIds.length) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }

    for (const assessment of assessments) {
      if (!teacherScopeCoversClassSubject(actor, assessment.classSubjectId)) {
        throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
      }
    }
    return
  }

  if (actorHasSchoolWideGrant(actor, SCHOOL_WIDE_ASSESSMENT_ACCESS_PERMISSIONS)) {
    return
  }

  const assessments = await repos.assessments.findByIds([...assessmentIds])
  if (assessments.length !== assessmentIds.length) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  for (const assessment of assessments) {
    const classSubjectPath = assessment.classSubjectId
      ? resourcePathForClassSubject(assessment.classGroupId, assessment.classSubjectId)
      : null
    const classGroupPath = resourcePathForClassGroup(assessment.classGroupId)
    const canAccess = (classSubjectPath
      ? actorGrantCoversAnyResourcePath(actor, CLASS_GROUP_ACCESS_PERMISSIONS, classSubjectPath)
      : false)
    || actorGrantCoversAnyResourcePath(actor, CLASS_GROUP_ACCESS_PERMISSIONS, classGroupPath)
    || actorGrantCoversAny(actor, CLASS_GROUP_ACCESS_PERMISSIONS, 'class_group', assessment.classGroupId)

    if (!canAccess) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
  }
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
  if (results.length === 0) {
    return
  }

  if (actor.kind === 'teacher') {
    for (const result of results) {
      assertTeacherCanReadReportCard(actor, result)
    }
    return
  }

  const studentIds = [...new Set(results.map(result => result.studentId))]
  await checkStudentAccess(actor, studentIds, repos)
}
