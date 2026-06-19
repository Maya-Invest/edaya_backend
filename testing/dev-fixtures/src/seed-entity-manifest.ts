/**
 * Maps seeded entity types to fixture modules and loader steps.
 * Used for documentation, completeness checks, and the HTTP validation harness (`bun seed:validate`).
 */

export interface SeedEntityManifestEntry {
  entity: string
  fixtureFile: string
  loader: string
  status: 'seeded' | 'partial' | 'missing'
  notes?: string
}

export const SEED_ENTITY_MANIFEST: readonly SeedEntityManifestEntry[] = [
  { entity: 'schools', fixtureFile: 'dataset.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'academic-years', fixtureFile: 'dataset.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'academic-periods', fixtureFile: 'dataset.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'grade-levels', fixtureFile: 'dataset.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'period-definitions', fixtureFile: 'dataset.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'class-groups', fixtureFile: 'dataset.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'staff-members', fixtureFile: 'dataset.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'students', fixtureFile: 'dataset.ts + population-seed.ts', loader: 'run-dev-school-seed', status: 'seeded', notes: '30 students across 8 classes' },
  { entity: 'enrollments', fixtureFile: 'dataset.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'guardians', fixtureFile: 'dataset.ts + population-seed.ts', loader: 'run-dev-school-seed', status: 'seeded', notes: '21 guardians' },
  { entity: 'guardian-links', fixtureFile: 'dataset.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'subjects', fixtureFile: 'dataset.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'subject-matters', fixtureFile: 'dataset.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'class-subjects', fixtureFile: 'dataset.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'class-subject-matters', fixtureFile: 'dataset.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'resources', fixtureFile: 'dataset.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'schedules', fixtureFile: 'scheduling-seed.ts', loader: 'run-dev-school-seed', status: 'seeded', notes: 'Classes 6a, 6b, 5a' },
  { entity: 'sessions', fixtureFile: 'scheduling-seed.ts', loader: 'run-dev-school-seed', status: 'seeded', notes: 'Classes 6a, 6b, 5a' },
  { entity: 'staff-assignments', fixtureFile: 'dataset.ts', loader: 'run-dev-access-seed', status: 'seeded', notes: 'Homeroom + class-subject teachers' },
  { entity: 'resource-assignments', fixtureFile: 'dataset.ts', loader: 'run-dev-school-seed', status: 'partial' },
  { entity: 'class-subject-progress', fixtureFile: 'dataset.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'assessments', fixtureFile: 'assessments-seed.ts', loader: 'run-dev-school-seed', status: 'seeded', notes: 'All trimesters; classes 6a, 6b, 5a, 4a, 3a, term-s' },
  { entity: 'assessment-results', fixtureFile: 'assessments-seed.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'homework-assignments', fixtureFile: 'homework-seed.ts', loader: 'run-dev-school-seed', status: 'seeded', notes: 'Classes 6a and 6b across trimesters' },
  { entity: 'homework-submissions', fixtureFile: 'homework-seed.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'activities', fixtureFile: 'activities-seed.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'activity-enrollments', fixtureFile: 'activities-seed.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'class-logbook-entries', fixtureFile: 'teaching-log-seed.ts', loader: 'run-dev-school-seed', status: 'partial' },
  { entity: 'calendar-events', fixtureFile: 'calendar-seed.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'incidents', fixtureFile: 'dataset.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'student-incident-involvements', fixtureFile: 'dataset.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'attendance', fixtureFile: 'attendance-seed.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'student-health-profiles', fixtureFile: 'dataset.ts', loader: 'run-dev-school-seed', status: 'partial' },
  { entity: 'student-notes', fixtureFile: 'dataset.ts', loader: 'run-dev-school-seed', status: 'partial' },
  { entity: 'fees', fixtureFile: 'finance-seed.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'student-fees', fixtureFile: 'finance-seed.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'payments', fixtureFile: 'finance-seed.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'grade-scales', fixtureFile: 'report-cards-seed.ts', loader: 'seed-report-cards', status: 'seeded' },
  { entity: 'definitions', fixtureFile: 'report-cards-seed.ts', loader: 'seed-report-cards', status: 'seeded' },
  { entity: 'sections', fixtureFile: 'report-cards-seed.ts', loader: 'seed-report-cards', status: 'seeded' },
  { entity: 'results', fixtureFile: 'report-cards-seed.ts', loader: 'seed-report-cards', status: 'seeded', notes: '6a T1–T3 + term-s' },
  { entity: 'access-roles', fixtureFile: 'dataset.ts', loader: 'run-dev-access-seed', status: 'seeded' },
  { entity: 'staff-role-assignments', fixtureFile: 'dataset.ts', loader: 'run-dev-access-seed', status: 'seeded' },
  { entity: 'announcements', fixtureFile: 'communications-seed.ts', loader: 'run-dev-school-seed', status: 'seeded', notes: 'Published + draft' },
  { entity: 'announcement-targets', fixtureFile: 'communications-seed.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'message-deliveries', fixtureFile: 'communications-seed.ts', loader: 'run-dev-school-seed', status: 'seeded', notes: 'Materialized + explicit statuses' },
  { entity: 'disciplinary-actions', fixtureFile: 'discipline-seed.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'student-disciplinary-actions', fixtureFile: 'discipline-seed.ts', loader: 'run-dev-school-seed', status: 'seeded', notes: 'Linked to incidents i1–i3' },
  { entity: 'attachments', fixtureFile: 'attachments-seed.ts', loader: 'run-dev-school-seed', status: 'seeded', notes: 'Incidents, health, finance, academics' },
]

export function seedManifestEntitiesByStatus(status: SeedEntityManifestEntry['status']): SeedEntityManifestEntry[] {
  return SEED_ENTITY_MANIFEST.filter(entry => entry.status === status)
}
