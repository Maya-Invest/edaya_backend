import type { AcademicPeriod } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'
import { denyResourceAccess } from '@edaya/authorization'
import { BusinessRuleViolationError } from '@edaya/core'
import { assertPeriodSelectionIdentity, periodSelections, reconcilePeriodSelections } from '../../../../capabilities/subject-enrollment/calendar'
import { config } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

// Extracted from domain/school/academic-period.ts (PR3)
export const academicPeriodConfig: EntityConfigFactory<AcademicPeriod> = ({ repositories, atomicExecution }) => ({
  ...config({
    repository: repositories.academicPeriods,
    tenant: directSchoolTenant(),
    resource: 'academicPeriods',
    writeLockGroup: 'academic-state',
    hooks: { postSave: (period, previous, repositories) => reconcilePeriodSelections(repositories, period, previous) },

    atomicExecution,
  }),
  gates: {
    preSave: validateAcademicPeriodSave,
    preDelete: validateAcademicPeriodDelete,
  },
})

export async function validateAcademicPeriodSave(
  period: AcademicPeriod,
  _existing: AcademicPeriod | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  await assertPeriodSelectionIdentity(repositories, period, _existing)
  const academicYear = await repositories.academicYears.findById(period.academicYearId)
  if (!academicYear || academicYear.schoolId !== period.schoolId) {
    denyResourceAccess()
  }
  if (period.startDate.getTime() < academicYear.startDate.getTime() || period.endDate.getTime() > academicYear.endDate.getTime()) {
    throw new BusinessRuleViolationError('ACADEMIC_PERIOD_OUTSIDE_YEAR', `Academic period ${period.id} must fit within academic year ${period.academicYearId}`)
  }
}

export async function validateAcademicPeriodDelete(
  period: AcademicPeriod,
  repositories: SchoolRepositories,
): Promise<void> {
  const [assessments, reportCards, selections] = await Promise.all([
    repositories.assessments.list({ periodId: period.id }),
    repositories.results.list({ periodId: period.id }),
    periodSelections(repositories, period),
  ])
  if (assessments.length > 0 || reportCards.length > 0 || selections.length > 0) {
    throw new BusinessRuleViolationError('ACADEMIC_PERIOD_HAS_DEPENDENCIES', `Cannot delete academic period ${period.id}: dependent records still exist`)
  }
}
