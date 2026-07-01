import type { SchoolRepositories } from '../../../ports'
import { resolveSchoolContext } from './resolve-school-context'

export async function resolveSchoolName(
  repositories: Partial<Pick<SchoolRepositories, 'schools'>>,
  schoolId: string,
): Promise<string> {
  const { schoolName } = await resolveSchoolContext(repositories, schoolId)
  return schoolName
}
