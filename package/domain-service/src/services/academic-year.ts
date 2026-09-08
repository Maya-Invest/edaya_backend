import type { AcademicYear } from '@edaya/core'
import type { SchoolRepositories } from '../ports/school-repositories'

/**
 * Resolves the published academic year for a school.
 * If no published year is found, falls back to the first available academic year.
 */
export async function findPublishedAcademicYear(
  academicYearsRepository: SchoolRepositories['academicYears'],
  schoolId: string,
): Promise<AcademicYear | undefined> {
  const academicYears = await academicYearsRepository.list({ schoolId })
  return academicYears.find(academicYear => academicYear.status === 'published') ?? academicYears[0]
}

/** @deprecated Use findPublishedAcademicYear */
export const findActiveAcademicYear = findPublishedAcademicYear
