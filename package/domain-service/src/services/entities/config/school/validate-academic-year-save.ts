import type { ActorMetadata } from '@edaya/authorization'
import type { AcademicYear } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import { assertAcademicYearStatusTransition, BusinessRuleViolationError } from '@edaya/core'

export async function validateAcademicYearSave(
  entity: AcademicYear,
  existing: AcademicYear | undefined,
  _repos: SchoolRepositories,
  _actor: ActorMetadata,
): Promise<void> {
  if (!existing) {
    if (entity.status !== 'draft') {
      throw new BusinessRuleViolationError(
        'ACADEMIC_YEAR_INVALID_STATUS',
        'New academic years must be created with draft status',
      )
    }
    return
  }

  if (existing.status !== entity.status) {
    assertAcademicYearStatusTransition(existing.status, entity.status)
  }
}
