import type { SchoolRepositories } from '../../ports'

export async function resolveSchoolName(
  repositories: Partial<Pick<SchoolRepositories, 'schools'>>,
  schoolId: string,
): Promise<string> {
  if (!repositories.schools) {
    return schoolId
  }
  const school = await repositories.schools.findById(schoolId)
  return school?.name ?? schoolId
}
