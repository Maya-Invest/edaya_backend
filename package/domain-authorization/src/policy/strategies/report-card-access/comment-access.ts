import type { ReportCardResult, ReportCardResultSection } from '@edaya/core'
import type { TeacherActorMetadata } from '../../../model/actor'
import type { AuthorizationRepositories } from '../../../ports/authorization-repositories'
import {
  assertCommentOnlyReportCardUpdate,
  assertDraftReportCardForTeacherComment,
  collectCommentChanges,
  ReportCardDefinitionSectionKind,
} from '@edaya/core'
import {
  assertHomeroomCapability,
  assertTeachingCapability,
  HomeroomCapability,
  TeachingCapability,
} from '../../../capabilities'
import { AuthorizationError, AuthorizationErrorCode } from '../../../model/errors'

export function authorizeTeacherReportCardCommentSave(
  actor: TeacherActorMetadata,
  before: ReportCardResult,
  after: ReportCardResult,
): void {
  assertDraftReportCardForTeacherComment(before)
  assertCommentOnlyReportCardUpdate(before, after)

  const changes = collectCommentChanges(before, after)
  if (changes.length === 0) {
    return
  }

  for (const change of changes) {
    switch (change.kind) {
      case 'card':
        assertHomeroomCapability(actor, HomeroomCapability.WriteHomeroomReportComment, {
          classGroupId: after.classGroupId,
        })
        break
      case 'group':
        assertHomeroomCapability(actor, HomeroomCapability.WriteGroupReportComment, {
          classGroupId: after.classGroupId,
        })
        break
      case 'subject':
        assertTeachingCapability(actor, TeachingCapability.WriteSubjectReportComment, {
          classSubjectId: change.classSubjectId,
        })
        break
    }
  }
}

export function teacherCanReadReportCard(
  actor: TeacherActorMetadata,
  result: ReportCardResult,
): boolean {
  if (actor.teacherScope.homeroom.classGroupIds.includes(result.classGroupId)) {
    return true
  }

  const visit = (section: ReportCardResultSection): boolean => {
    if (
      section.sectionKind === ReportCardDefinitionSectionKind.Subject
      && section.classSubjectId
      && actor.teacherScope.teaching.classSubjectIds.includes(section.classSubjectId)
    ) {
      return true
    }
    return section.subResults.some(visit)
  }

  return result.sectionResults.some(visit)
}

export async function teacherTeachesReportCardClassGroup(
  actor: TeacherActorMetadata,
  classGroupId: string,
  repositories: AuthorizationRepositories,
): Promise<boolean> {
  const taughtClassSubjectIds = actor.teacherScope.teaching.classSubjectIds
  if (taughtClassSubjectIds.length === 0) {
    return false
  }

  const taughtIds = new Set(taughtClassSubjectIds)
  const classSubjects = await repositories.classSubjects.list({ classGroupId })
  return classSubjects.some(classSubject => taughtIds.has(classSubject.id))
}

export async function assertTeacherCanReadReportCard(
  actor: TeacherActorMetadata,
  result: ReportCardResult,
  repositories?: AuthorizationRepositories,
): Promise<void> {
  if (teacherCanReadReportCard(actor, result)) {
    return
  }

  if (repositories && await teacherTeachesReportCardClassGroup(actor, result.classGroupId, repositories)) {
    return
  }

  throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
}
