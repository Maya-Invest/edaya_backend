import type { School } from '@edaya/core'
import type { SchoolRepositories } from '../ports/school-repositories'
import { BusinessRuleViolationError } from '@edaya/core'

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
    throw new BusinessRuleViolationError('UNKNOWN_SCHOOL', `Unknown school: ${schoolId}`)
  }
  return school
}
