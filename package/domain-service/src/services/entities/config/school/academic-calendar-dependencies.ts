import type { AcademicPeriod, AcademicYear } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import { BusinessRuleViolationError } from '@edaya/core'

// Check references through trusted, school-scoped repositories, not the caller's
// visible collection. A hidden dependent record must still prevent deletion.
const yearReferences = [
  'academicPeriods',
  'periodDefinitions',
  'classGroups',
  'subjects',
  'reportModules',
  'studentAcademicYearProfiles',
  'teacherAcademicYearProfiles',
  'enrollments',
  'staffAssignments',
  'teacherAssignments',
  'teacherUnavailabilities',
  'staffPermissionAssignments',
  'staffPermissionProfileBindings',
  'staffManualPermissionAssignments',
  'staffPermissionScopeDefaults',
  'catalogServices',
  'studentServiceEnrollments',
  'studentCharges',
  'studentYearAccounts',
  'payments',
  'calendarEvents',
  'results',
  'documentIssuances',
  'documentNumberSeries',
  'familyFeedbackCampaigns',
] as const satisfies readonly (keyof SchoolRepositories)[]

export async function validateAcademicYearDelete(year: AcademicYear, repos: SchoolRepositories): Promise<void> {
  if (year.status !== 'draft')
    throw new BusinessRuleViolationError('ACADEMIC_YEAR_NOT_DRAFT', 'Only draft academic years can be deleted')
  for (const resource of yearReferences) {
    if (await repos[resource].count({ academicYearId: year.id })) {
      throw new BusinessRuleViolationError('ACADEMIC_YEAR_HAS_DEPENDENCIES', 'Cannot delete academic year: dependent records still exist')
    }
  }
  const levels = await repos.gradeLevels.list({ schoolId: year.schoolId })
  if (levels.some(level => level.gradingPolicies.some(policy => policy.academicYearId === year.id) || level.reportSettings.some(settings => settings.academicYearId === year.id))) {
    throw new BusinessRuleViolationError('ACADEMIC_YEAR_HAS_DEPENDENCIES', 'Cannot delete academic year: dependent records still exist')
  }
}

export async function assertAcademicPeriodUnused(period: AcademicPeriod, repos: SchoolRepositories): Promise<void> {
  const [campaigns, documents, results] = await Promise.all([
    repos.familyFeedbackCampaigns.count({ academicPeriodId: period.id }),
    repos.documentIssuances.list({ academicYearId: period.academicYearId }),
    repos.results.list({ academicYearId: period.academicYearId }),
  ])
  if (campaigns || documents.some(document => document.snapshot.academicPeriodId === period.id || document.snapshot.academicSources?.some(source => source.periodId === period.id))
    || results.some(result => result.aggregation?.sourcePeriodIds.includes(period.id) || result.aggregation?.sourceReportVersions?.some(source => source.periodId === period.id))) {
    throw new BusinessRuleViolationError('ACADEMIC_PERIOD_HAS_DEPENDENCIES', 'Cannot delete academic period: dependent records still exist')
  }
}
