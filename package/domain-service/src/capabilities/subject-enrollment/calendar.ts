import type { AcademicPeriod, AcademicYear } from '@edaya/core'
import type { SchoolRepositories } from '../../ports/school-repositories'
import { BusinessRuleViolationError, StudentSubjectEnrollment } from '@edaya/core'
import { loadInBatches } from '../shared/bounded-reads'
import { schoolDayStart } from './dates'
import { persistSubjectEnrollment } from './persistence'
import { loadSubjectWork } from './work'

export async function periodSelections(repositories: SchoolRepositories, period: AcademicPeriod) {
  const groups = await repositories.classGroups.list({ academicYearId: period.academicYearId })
  const placements = await loadInBatches(groups.map(row => row.id), ids => repositories.enrollments.list({ classGroupId: { $in: ids } }))
  return (await loadInBatches(placements.map(row => row.id), ids => repositories.subjectEnrollments.list({ studentClassEnrollmentId: { $in: ids } }))).filter(row => row.periods.some(choice => choice.periodId === period.id))
}

export async function reconcilePeriodSelections(repositories: SchoolRepositories, period: AcademicPeriod, previous?: AcademicPeriod) {
  if (!previous || (period.startDate.getTime() === previous.startDate.getTime() && period.endDate.getTime() === previous.endDate.getTime()))
    return
  const school = await repositories.schools.findById(period.schoolId)
  const zone = school?.timeZone ?? 'UTC'
  const rows = (await periodSelections(repositories, period)).filter(row => !row.deletedAt)
  const work = new Map(await Promise.all([...new Set(rows.map(row => row.classSubjectId))].map(async id => [id, await loadSubjectWork(repositories, id)] as const)))
  for (const row of rows) {
    await persistSubjectEnrollment(repositories, new StudentSubjectEnrollment({ ...row.data, revision: row.revision + 1, periods: row.periods.map(choice => choice.periodId === period.id ? { ...choice, startsAt: schoolDayStart(period.startDate, zone), endsAt: schoolDayStart(period.endDate, zone, 1) } : choice) }), row, work.get(row.classSubjectId))
  }
}

export async function assertPeriodSelectionIdentity(repositories: SchoolRepositories, period: AcademicPeriod, previous?: AcademicPeriod) {
  if (previous && (previous.schoolId !== period.schoolId || previous.academicYearId !== period.academicYearId) && (await periodSelections(repositories, previous)).length)
    throw new BusinessRuleViolationError('ACADEMIC_PERIOD_HAS_DEPENDENCIES', 'An enrollment period cannot be moved to another school or academic year')
}

/** Keep current selections bounded when the school adjusts its year calendar. */
export async function reconcileYearSelections(repositories: SchoolRepositories, year: AcademicYear, previous?: AcademicYear) {
  if (!previous || (year.startDate.getTime() === previous.startDate.getTime() && year.endDate.getTime() === previous.endDate.getTime()))
    return
  const groups = await repositories.classGroups.list({ academicYearId: year.id })
  const placements = await loadInBatches(groups.map(row => row.id), ids => repositories.enrollments.list({ classGroupId: { $in: ids } }))
  const byId = new Map(placements.map(row => [row.id, row]))
  const rows = (await loadInBatches(placements.map(row => row.id), ids => repositories.subjectEnrollments.list({ studentClassEnrollmentId: { $in: ids } }))).filter(row => !row.deletedAt)
  const school = await repositories.schools.findById(year.schoolId)
  const zone = school?.timeZone ?? 'UTC'
  const start = schoolDayStart(year.startDate, zone)
  const end = schoolDayStart(year.endDate, zone, 1)
  const work = new Map(await Promise.all([...new Set(rows.map(row => row.classSubjectId))].map(async id => [id, await loadSubjectWork(repositories, id)] as const)))
  for (const row of rows) {
    const placement = byId.get(row.studentClassEnrollmentId)!
    const enrolledAt = new Date(Math.max(row.enrolledAt.getTime(), start.getTime(), placement.enrolledAt.getTime()))
    const endedAt = new Date(Math.min(end.getTime(), placement.endedAt?.getTime() ?? Infinity))
    if (endedAt <= enrolledAt)
      throw new BusinessRuleViolationError('ACADEMIC_YEAR_ENROLLMENT_CONFLICT', 'The year must include existing enrollment activation dates')
    await persistSubjectEnrollment(repositories, new StudentSubjectEnrollment({ ...row.data, enrolledAt, endedAt, revision: row.revision + 1 }), row, work.get(row.classSubjectId))
  }
}
