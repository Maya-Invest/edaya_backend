import type { ClassSubject, Subject } from '@edaya/core'
import type { BaseSchoolService } from '../../services/base-school-service'
import { BusinessRuleViolationError } from '@edaya/core'
import { validateSubjectSave } from '../../services/entities/config/academics/subject'
import { reconcileSubjectPolicy } from './reconcile'

export function assertParticipationRevision(offering: ClassSubject, expected: number | undefined): void {
  if (expected !== offering.participationRevision)
    throw new BusinessRuleViolationError('SUBJECT_PARTICIPATION_REVISION_CONFLICT', 'The subject roster changed. Reload before retrying', { classSubjectId: offering.id, expectedRevision: expected, actualRevision: offering.participationRevision })
}

/** The parent curriculum command holds academic-state and authorizes this policy change. */
export async function saveSubjectPolicy(base: BaseSchoolService, updated: Subject, previous: Subject, expected: Record<string, number> | undefined): Promise<void> {
  const scope = await base.access.entity('subjects').assertSave(updated, previous)
  await validateSubjectSave(updated, previous, base.repositories, true)
  for (const offering of await base.repositories.classSubjects.list({ subjectId: updated.id }))
    assertParticipationRevision(offering, expected?.[offering.id])
  await base.repositories.subjects.forAccess(scope).save(updated)
  await reconcileSubjectPolicy(base.repositories, updated, previous, base.actor)
}
