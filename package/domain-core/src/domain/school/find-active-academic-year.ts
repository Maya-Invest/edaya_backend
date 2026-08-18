import type { BaseRepositoryInterface } from '../../ports/repositories/base-repository'
import type { AcademicYear } from './academic-year'

/**
 * Resolves the published academic year for a school.
 * If no published year is found, falls back to the first available academic year.
 */
export async function findPublishedAcademicYear(
  academicYearsRepository: BaseRepositoryInterface<AcademicYear>,
  schoolId: string,
): Promise<AcademicYear | undefined> {
  const academicYears = await academicYearsRepository.list({ schoolId })
  return academicYears.find(academicYear => academicYear.status === 'published') ?? academicYears[0]
}

/** @deprecated Use findPublishedAcademicYear */
export const findActiveAcademicYear = findPublishedAcademicYear
