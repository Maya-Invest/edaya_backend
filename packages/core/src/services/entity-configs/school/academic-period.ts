import type { AcademicPeriod } from '../../../entities/school/academic-period'
import type { SchoolRepositories } from '../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../../shared/common'
import { denyResourceAccess } from '../../../authorization/authorization-error'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'
import { directEntityConfig } from '../../../shared/common'

export const academicPeriodConfig: EntityConfigFactory<AcademicPeriod> = (input) => {
  const config = directEntityConfig(input, input.repositories.academicPeriods, 'queries.read_workspace', 'setup.manage')
  return {
    ...config,
    gates: {
      preSave: validateAcademicPeriodSave,
      preDelete: validateAcademicPeriodDelete,
    },
  }
}

export async function validateAcademicPeriodSave(
  period: AcademicPeriod,
  _existing: AcademicPeriod | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
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
  const [assessments, reportCards] = await Promise.all([
    repositories.assessments.list({ periodId: period.id }),
    repositories.results.list({ periodId: period.id }),
  ])
  if (assessments.length > 0 || reportCards.length > 0) {
    throw new BusinessRuleViolationError('ACADEMIC_PERIOD_HAS_DEPENDENCIES', `Cannot delete academic period ${period.id}: dependent records still exist`)
  }
}
