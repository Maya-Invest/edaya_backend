/**
 * Maps seeded entity types to fixture modules and loader steps.
 * Used for documentation, completeness checks, and the HTTP validation harness (`bun run test:integration:seed`).
 */

import type { FixtureDatasetPurpose } from '../datasets/types'

interface SeedEntityManifestEntryShape {
  entity: string
  fixtureFile: string
  loader: string
  status: SeedEntityManifestStatus
  /** Typed dataset when the entity is covered by a purpose-driven fixture set. */
  dataset?: FixtureDatasetPurpose
  notes?: string
}

export type SeedEntityManifestStatus = 'seeded' | 'partial' | 'missing'

export const SEED_ENTITY_MANIFEST = [
  { entity: 'schools', fixtureFile: 'demoDataset.entities.school', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo' },
  { entity: 'academic-years', fixtureFile: 'demoDataset.entities.academicYear', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo' },
  { entity: 'academic-periods', fixtureFile: 'demoDataset.entities.academicPeriods', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo' },
  { entity: 'grade-levels', fixtureFile: 'demoDataset.entities.gradeLevels', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo' },
  { entity: 'period-definitions', fixtureFile: 'demoDataset.entities.periodDefinitions', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo' },
  { entity: 'class-groups', fixtureFile: 'demoDataset.entities.classGroups', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo', notes: 'Foundation + extended classes' },
  { entity: 'staff-members', fixtureFile: 'demoDataset.entities.staffMembers', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo' },
  { entity: 'students', fixtureFile: 'demoDataset.entities.students', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo', notes: '30 narrative students across foundation + extended classes' },
  { entity: 'enrollments', fixtureFile: 'demoDataset.entities.enrollments', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo' },
  { entity: 'guardians', fixtureFile: 'demoDataset.entities.guardians', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo', notes: '21 guardians linked to narrative students' },
  { entity: 'guardian-links', fixtureFile: 'demoDataset.entities.guardianLinks', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo' },
  { entity: 'subjects', fixtureFile: 'demoDataset.entities.subjects', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo' },
  { entity: 'subject-matters', fixtureFile: 'demoDataset.entities.subjectMatters', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo' },
  { entity: 'class-subjects', fixtureFile: 'demoDataset.entities.classSubjects', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo' },
  { entity: 'class-subject-matters', fixtureFile: 'datasets/demo/people.ts', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo' },
  { entity: 'teachers', fixtureFile: 'datasets/demo/teachers.ts', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo', notes: 'Portal teachers (not staff)' },
  { entity: 'teacher-assignments', fixtureFile: 'datasets/demo/teachers.ts', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo' },
  { entity: 'resources', fixtureFile: 'demoDataset.entities.resources', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo' },
  { entity: 'schedules', fixtureFile: 'demoDataset.entities.schedules', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo', notes: 'Classes 6a, 6b, 5a' },
  { entity: 'lesson-sessions', fixtureFile: 'demoDataset.extensions.schedulingSlots', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo', notes: 'Classes 6a, 6b, 5a' },
  { entity: 'staff-assignments', fixtureFile: 'datasets/demo/people.ts', loader: 'run-dev-access-seed', status: 'seeded', dataset: 'demo', notes: 'Homeroom + class-subject teachers' },
  { entity: 'resource-assignments', fixtureFile: 'demoDataset.extensions.classResourceAssignments + schedulingSlots', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo', notes: 'Class homeroom resources + lesson-session rooms' },
  { entity: 'class-subject-progress', fixtureFile: 'demoDataset.extensions.schedulingSessionProgressAnchor', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo' },
  { entity: 'assessments', fixtureFile: 'demoDataset.entities.inClassAssessments + homeworkAssessments', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo', notes: 'In-class + homework; all trimesters' },
  { entity: 'assessment-results', fixtureFile: 'demoDataset.extensions.assessmentResultScores + homeworkSubmissions', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo', notes: 'Scores + homework submission compliance' },
  { entity: 'activities', fixtureFile: 'demoDataset.entities.activities', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo' },
  { entity: 'activity-enrollments', fixtureFile: 'demoDataset.entities.activityEnrollments', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo' },
  { entity: 'calendar-events', fixtureFile: 'demoDataset.extensions.calendarEvents', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo' },
  { entity: 'incidents', fixtureFile: 'demoDataset.entities.incidents', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo' },
  { entity: 'student-incident-involvements', fixtureFile: 'demoDataset.entities.studentIncidentInvolvements', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo' },
  { entity: 'attendance', fixtureFile: 'demoDataset.entities.attendanceRecords + extensions.attendanceSessions', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo', notes: 'Absence sessions + reference-date class attendance' },
  { entity: 'student-health-profiles', fixtureFile: 'demoDataset.entities.studentHealthProfiles', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo' },
  { entity: 'student-notes', fixtureFile: 'demoDataset.entities.studentNotes', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo' },
  { entity: 'catalog-services', fixtureFile: 'demoDataset.entities.catalogServices', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo' },
  { entity: 'student-service-enrollments', fixtureFile: 'demoDataset.entities.studentServiceEnrollments', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo' },
  { entity: 'payments', fixtureFile: 'demoDataset.entities.payments', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo' },
  { entity: 'document-issuances', fixtureFile: 'demoDataset.extensions.documentIssuances', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo', notes: 'Ready bulletin, receipt, certificate plus a failed certificate for UI states' },
  { entity: 'grade-scales', fixtureFile: 'demoDataset.entities.gradeScales', loader: 'seed-report-cards', status: 'seeded', dataset: 'demo' },
  { entity: 'definitions', fixtureFile: 'demoDataset.extensions.reportCardDefinitionFixtures', loader: 'seed-report-cards', status: 'seeded', dataset: 'demo' },
  { entity: 'sections', fixtureFile: 'demoDataset.extensions.reportCardDefinitionFixtures', loader: 'seed-report-cards', status: 'seeded', dataset: 'demo' },
  { entity: 'results', fixtureFile: 'demoDataset.extensions.reportCardResults', loader: 'seed-report-cards', status: 'seeded', dataset: 'demo', notes: '6a T1–T3 + term-s' },
  { entity: 'staff-permission-assignments', fixtureFile: 'meta/dev-auth-fixtures.ts', loader: 'run-dev-access-seed', status: 'seeded' },
  { entity: 'announcements', fixtureFile: 'demoDataset.entities.announcements', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo', notes: 'Published + draft' },
  { entity: 'announcement-targets', fixtureFile: 'demoDataset.entities.announcementTargets', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo' },
  { entity: 'message-deliveries', fixtureFile: 'demoDataset.entities.messageDeliveries + extensions.announcementMaterializePlans', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo', notes: 'Materialized + explicit statuses' },
  { entity: 'disciplinary-actions', fixtureFile: 'demoDataset.entities.disciplinaryActions', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo' },
  { entity: 'student-disciplinary-actions', fixtureFile: 'demoDataset.entities.studentDisciplinaryActions', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo', notes: 'Linked to incidents i1–i3' },
  { entity: 'attachments', fixtureFile: 'demoDataset.entities.attachments', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo', notes: 'Incidents, health, finance, academics' },
  { entity: 'profile-photos', fixtureFile: 'shared/profile-pictures.ts + assets/profile-pictures/pic####.jpg', loader: 'run-dev-school-seed', status: 'seeded', notes: 'Staff, students, guardians via file storage' },
] as const satisfies readonly SeedEntityManifestEntryShape[]

export type SeedEntitySlug = (typeof SEED_ENTITY_MANIFEST)[number]['entity']
export type SeedEntityManifestEntry = (typeof SEED_ENTITY_MANIFEST)[number]

export function seedManifestEntitiesByStatus(status: SeedEntityManifestStatus): SeedEntityManifestEntry[] {
  return [...SEED_ENTITY_MANIFEST.filter(entry => entry.status === status)]
}
