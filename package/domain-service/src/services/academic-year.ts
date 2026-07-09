import type { AcademicYear } from '@edaya/core'
import type { SchoolRepositories } from '@edaya/service'

/**
 * Resolves the active academic year for a school.
 * If no active year is found, falls back to the first available academic year.
 */
export async function findActiveAcademicYear(
  academicYearsRepository: SchoolRepositories['academicYears'],
  schoolId: string,
): Promise<AcademicYear | undefined> {
  const academicYears = await academicYearsRepository.list({ schoolId })
  return academicYears.find(academicYear => academicYear.isActive) ?? academicYears[0]
}
