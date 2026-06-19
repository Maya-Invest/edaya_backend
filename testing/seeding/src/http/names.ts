/** Maps `SchoolService.baseService` repository keys to entity route segments. */
export const ENTITY_SERVICE_TO_PUBLIC_NAME: Record<string, string> = {
  schools: 'schools',
  academicYears: 'academic-years',
  academicPeriods: 'academic-periods',
  gradeLevels: 'grade-levels',
  periodDefinitions: 'period-definitions',
  classGroups: 'class-groups',
  staffMembers: 'staff-members',
  staffAssignments: 'staff-assignments',
  accessRoles: 'access-roles',
  staffRoleAssignments: 'staff-role-assignments',
  attachments: 'attachments',
  resources: 'resources',
  resourceAssignments: 'resource-assignments',
  fees: 'fees',
  studentFees: 'student-fees',
  payments: 'payments',
  schedules: 'schedules',
  sessions: 'sessions',
  calendarEvents: 'calendar-events',
  attendance: 'attendance',
  announcements: 'announcements',
  announcementTargets: 'announcement-targets',
  messageDeliveries: 'message-deliveries',
  subjects: 'subjects',
  subjectMatters: 'subject-matters',
  classSubjects: 'class-subjects',
  classSubjectMatters: 'class-subject-matters',
  classSubjectProgress: 'class-subject-progress',
  classLogbookEntries: 'class-logbook-entries',
  homeworkAssignments: 'homework-assignments',
  homeworkSubmissions: 'homework-submissions',
  activities: 'activities',
  activityEnrollments: 'activity-enrollments',
  assessments: 'assessments',
  assessmentResults: 'assessment-results',
  gradeScales: 'grade-scales',
  definitions: 'definitions',
  sections: 'sections',
  results: 'results',
  guardians: 'guardians',
  guardianLinks: 'guardian-links',
  studentNotes: 'student-notes',
  studentHealthProfiles: 'student-health-profiles',
  studentDisciplinaryActions: 'student-disciplinary-actions',
  disciplinaryActions: 'disciplinary-actions',
  studentIncidentInvolvements: 'student-incident-involvements',
  incidents: 'incidents',
}

/** Maps top-level `SeedApplication.repositories` keys to entity route segments. */
export const REPOSITORY_SERVICE_TO_PUBLIC_NAME: Record<string, string> = {
  schools: 'schools',
  students: 'students',
  enrollments: 'enrollments',
  staffMembers: 'staff-members',
  guardians: 'guardians',
  accessRoles: 'access-roles',
  staffRoleAssignments: 'staff-role-assignments',
  staffAssignments: 'staff-assignments',
  studentNotes: 'student-notes',
  results: 'results',
  attendance: 'attendance',
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
