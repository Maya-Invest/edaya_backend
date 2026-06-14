/** Maps `SchoolService.baseService` repository keys to entity route segments. */
export const ENTITY_SERVICE_TO_PUBLIC_NAME: Record<string, string> = {
  schools: 'schools',
  gradeLevels: 'grade-levels',
  periodDefinitions: 'period-definitions',
  subjects: 'subjects',
  subjectMatters: 'subject-matters',
  resources: 'resources',
  homeworkAssignments: 'homework-assignments',
  homeworkSubmissions: 'homework-submissions',
  activities: 'activities',
  activityEnrollments: 'activity-enrollments',
  classLogbookEntries: 'class-logbook-entries',
  accessRoles: 'access-roles',
  staffRoleAssignments: 'staff-role-assignments',
  staffAssignments: 'staff-assignments',
  staffMembers: 'staff-members',
  guardians: 'guardians',
  studentNotes: 'student-notes',
  results: 'results',
}

/** Maps top-level `SeedApplication.repositories` keys to entity route segments. */
export const REPOSITORY_SERVICE_TO_PUBLIC_NAME: Record<string, string> = {
  schools: 'schools',
  students: 'students',
  staffMembers: 'staff-members',
  guardians: 'guardians',
  accessRoles: 'access-roles',
  staffRoleAssignments: 'staff-role-assignments',
  staffAssignments: 'staff-assignments',
  studentNotes: 'student-notes',
  results: 'results',
}

export function entityPublicName(serviceName: string): string {
  const publicName = ENTITY_SERVICE_TO_PUBLIC_NAME[serviceName] ?? REPOSITORY_SERVICE_TO_PUBLIC_NAME[serviceName]
  if (!publicName) {
    throw new Error(`Unknown entity service for HTTP seeding: ${serviceName}`)
  }
  return publicName
}

export function commandMethodToPublicName(methodName: string): string {
  return methodName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}
