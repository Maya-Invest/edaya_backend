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
  { entity: 'schools', fixtureFile: 'scenarios/demo-central/core.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'academic-years', fixtureFile: 'scenarios/demo-central/core.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'academic-periods', fixtureFile: 'scenarios/demo-central/core.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'grade-levels', fixtureFile: 'scenarios/demo-central/core.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'period-definitions', fixtureFile: 'scenarios/demo-central/core.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'class-groups', fixtureFile: 'scenarios/demo-central/core.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'staff-members', fixtureFile: 'scenarios/demo-central/core.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'students', fixtureFile: 'scenarios/demo-central/core.ts + scenarios/generators/population-generator.ts', loader: 'run-dev-school-seed', status: 'seeded', notes: '1000 students across narrative + bulk classes' },
  { entity: 'enrollments', fixtureFile: 'scenarios/demo-central/core.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'guardians', fixtureFile: 'scenarios/demo-central/core.ts + scenarios/generators/population-generator.ts', loader: 'run-dev-school-seed', status: 'seeded', notes: '~991 guardians (narrative + bulk)' },
  { entity: 'guardian-links', fixtureFile: 'scenarios/demo-central/core.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'subjects', fixtureFile: 'scenarios/demo-central/core.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'subject-matters', fixtureFile: 'scenarios/demo-central/core.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'class-subjects', fixtureFile: 'scenarios/demo-central/core.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'class-subject-matters', fixtureFile: 'scenarios/demo-central/core.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'resources', fixtureFile: 'scenarios/demo-central/core.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'schedules', fixtureFile: 'scenarios/demo-central/domains/scheduling.ts', loader: 'run-dev-school-seed', status: 'seeded', notes: 'Classes 6a, 6b, 5a' },
  { entity: 'lesson-sessions', fixtureFile: 'scenarios/demo-central/domains/scheduling.ts', loader: 'run-dev-school-seed', status: 'seeded', notes: 'Classes 6a, 6b, 5a' },
  { entity: 'staff-assignments', fixtureFile: 'scenarios/demo-central/core.ts', loader: 'run-dev-access-seed', status: 'seeded', notes: 'Homeroom + class-subject teachers' },
  { entity: 'resource-assignments', fixtureFile: 'scenarios/demo-central/core.ts', loader: 'run-dev-school-seed', status: 'partial' },
  { entity: 'class-subject-progress', fixtureFile: 'scenarios/demo-central/core.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'assessments', fixtureFile: 'scenarios/demo-central/domains/assessments.ts + scenarios/demo-central/domains/homework.ts', loader: 'run-dev-school-seed', status: 'seeded', notes: 'In-class + homework consolidated; all trimesters; classes 6a, 6b, 5a, 4a, 3a, term-s' },
  { entity: 'assessment-results', fixtureFile: 'scenarios/demo-central/domains/assessments.ts + scenarios/demo-central/domains/homework.ts', loader: 'run-dev-school-seed', status: 'seeded', notes: 'Scores + homework submission compliance' },
  { entity: 'activities', fixtureFile: 'scenarios/demo-central/domains/activities.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'activity-enrollments', fixtureFile: 'scenarios/demo-central/domains/activities.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'calendar-events', fixtureFile: 'scenarios/demo-central/domains/calendar.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'incidents', fixtureFile: 'scenarios/demo-central/core.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'student-incident-involvements', fixtureFile: 'scenarios/demo-central/core.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'attendance', fixtureFile: 'scenarios/demo-central/domains/attendance.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'student-health-profiles', fixtureFile: 'scenarios/demo-central/core.ts', loader: 'run-dev-school-seed', status: 'partial' },
  { entity: 'student-notes', fixtureFile: 'scenarios/demo-central/core.ts', loader: 'run-dev-school-seed', status: 'partial' },
  { entity: 'fees', fixtureFile: 'scenarios/demo-central/domains/finance.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'student-fees', fixtureFile: 'scenarios/demo-central/domains/finance.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'payments', fixtureFile: 'scenarios/demo-central/domains/finance.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'grade-scales', fixtureFile: 'scenarios/demo-central/domains/report-cards.ts', loader: 'seed-report-cards', status: 'seeded' },
  { entity: 'definitions', fixtureFile: 'scenarios/demo-central/domains/report-cards.ts', loader: 'seed-report-cards', status: 'seeded' },
  { entity: 'sections', fixtureFile: 'scenarios/demo-central/domains/report-cards.ts', loader: 'seed-report-cards', status: 'seeded' },
  { entity: 'results', fixtureFile: 'scenarios/demo-central/domains/report-cards.ts', loader: 'seed-report-cards', status: 'seeded', notes: '6a T1–T3 + term-s' },
  { entity: 'access-roles', fixtureFile: 'scenarios/demo-central/core.ts', loader: 'run-dev-access-seed', status: 'seeded' },
  { entity: 'staff-role-assignments', fixtureFile: 'scenarios/demo-central/core.ts', loader: 'run-dev-access-seed', status: 'seeded' },
  { entity: 'announcements', fixtureFile: 'scenarios/demo-central/domains/communications.ts', loader: 'run-dev-school-seed', status: 'seeded', notes: 'Published + draft' },
  { entity: 'announcement-targets', fixtureFile: 'scenarios/demo-central/domains/communications.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'message-deliveries', fixtureFile: 'scenarios/demo-central/domains/communications.ts', loader: 'run-dev-school-seed', status: 'seeded', notes: 'Materialized + explicit statuses' },
  { entity: 'disciplinary-actions', fixtureFile: 'scenarios/demo-central/domains/discipline.ts', loader: 'run-dev-school-seed', status: 'seeded' },
  { entity: 'student-disciplinary-actions', fixtureFile: 'scenarios/demo-central/domains/discipline.ts', loader: 'run-dev-school-seed', status: 'seeded', notes: 'Linked to incidents i1–i3' },
  { entity: 'attachments', fixtureFile: 'scenarios/demo-central/domains/attachments.ts', loader: 'run-dev-school-seed', status: 'seeded', notes: 'Incidents, health, finance, academics' },
  { entity: 'profile-photos', fixtureFile: 'shared/profile-pictures.ts + assets/profile-pictures/pic####.jpg', loader: 'run-dev-school-seed', status: 'seeded', notes: 'Staff, students, guardians via file storage' },
]

export function seedManifestEntitiesByStatus(status: SeedEntityManifestEntry['status']): SeedEntityManifestEntry[] {
  return SEED_ENTITY_MANIFEST.filter(entry => entry.status === status)
}
