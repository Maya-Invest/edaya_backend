import type { ReportCardResult } from '../../../../domain/assessments/report-card-result'
import type { SchoolRepositories } from '../../../../ports/repositories/school-repositories'
import type { ActorMetadata } from '../../model/actor'
import {
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
import { dispatchClassGroupAccess, dispatchReportCardResultAccess } from '../compose'
import {
  authorizeReportCardCommentSave,
} from '../strategies/report-card-access'
import {
  CLASS_GROUP_ACCESS_PERMISSIONS,
  SCHOOL_WIDE_ASSESSMENT_ACCESS_PERMISSIONS,
} from './permission-sets'
import { checkStudentAccess } from './student'

export async function checkClassGroupAccess(
  actor: ActorMetadata,
  classGroupIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  if (classGroupIds.length === 0) {
    return
  }

  await dispatchClassGroupAccess(actor, classGroupIds, repos)
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

  await dispatchReportCardResultAccess(actor, results, repos)
}

export async function authorizeReportCardResultSave(
  actor: ActorMetadata,
  entity: ReportCardResult,
  existing: ReportCardResult | undefined,
  repos: SchoolRepositories,
): Promise<void> {
  await checkStudentAccess(actor, [entity.studentId], repos)

  if (!existing) {
    if (actor.kind === 'teacher') {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
    return
  }

  if (actor.kind !== 'staff' && actor.kind !== 'teacher') {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  await authorizeReportCardCommentSave(actor, existing, entity, repos)
}
