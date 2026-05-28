import type { School } from '../../entities/school/school'
import type { SchoolRepositories } from '../../ports/school-repositories'

/**
 * Fetches a school by ID and throws a descriptive error if it doesn't exist.
 * Shared across all service modules so we don't duplicate this guard.
 */
export async function requireSchool(
  schools: SchoolRepositories['schools'],
  schoolId: string,
): Promise<School> {
  const school = await schools.findById(schoolId)
  if (!school) {
    throw new Error(`Unknown school: ${schoolId}`)
  }
  return school
}
