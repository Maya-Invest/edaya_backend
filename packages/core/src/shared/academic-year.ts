import type { AcademicYear } from '../domains'
import type { SchoolRepositories } from '../ports/school-repositories'

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
