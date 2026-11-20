import type { AcademicYear } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import { assertAcademicYearStatusTransition, BusinessRuleViolationError } from '@edaya/core'

export async function validateAcademicYearSave(
  entity: AcademicYear,
  existing: AcademicYear | undefined,
  repos: SchoolRepositories,
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
    if (entity.status === 'published' && (await repos.academicYears.list({ schoolId: entity.schoolId, status: 'published' })).some(year => year.id !== entity.id)) {
      throw new BusinessRuleViolationError('ACADEMIC_YEAR_ALREADY_PUBLISHED', 'Another academic year is already published')
    }
  }
  if (existing.status === 'archived') {
    throw new BusinessRuleViolationError('ACADEMIC_YEAR_ARCHIVED', 'Archived academic years are read-only')
  }
  if (existing.startDate.getTime() !== entity.startDate.getTime() || existing.endDate.getTime() !== entity.endDate.getTime()) {
    const periods = await repos.academicPeriods.list({ academicYearId: entity.id })
    if (periods.some(period => period.startDate < entity.startDate || period.endDate > entity.endDate)) {
      throw new BusinessRuleViolationError('ACADEMIC_YEAR_EXCLUDES_PERIODS', 'The year must include all its periods')
    }
  }
}
