import type { SchoolRepositories } from '@edaya/service'

export interface SchoolNotificationContext {
  schoolName: string
  timeZone: string
}

export async function resolveSchoolContext(
  repositories: Partial<Pick<SchoolRepositories, 'schools'>>,
  schoolId: string,
): Promise<SchoolNotificationContext> {
  if (!repositories.schools?.findById) {
    return { schoolName: schoolId, timeZone: 'UTC' }
  }

  const school = await repositories.schools.findById(schoolId)
  return {
    schoolName: school?.name ?? schoolId,
    timeZone: school?.timeZone ?? 'UTC',
  }
}
