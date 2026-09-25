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
  { entity: 'schools', fixtureFile: 'demoCiDataset.entities.school', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci' },
  { entity: 'academic-years', fixtureFile: 'demoCiDataset.entities.academicYear', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci' },
  { entity: 'academic-periods', fixtureFile: 'demoCiDataset.entities.academicPeriods', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci' },
  { entity: 'grade-levels', fixtureFile: 'demoCiDataset.entities.gradeLevels', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci' },
  { entity: 'period-definitions', fixtureFile: 'demoCiDataset.entities.periodDefinitions', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci' },
  { entity: 'class-groups', fixtureFile: 'demoCiDataset.entities.classGroups', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci', notes: 'Foundation + extended classes' },
  { entity: 'staff-members', fixtureFile: 'demoCiDataset.entities.staffMembers', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci' },
  { entity: 'students', fixtureFile: 'demoCiDataset.entities.students', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci', notes: '30 narrative students across foundation + extended classes' },
  { entity: 'enrollments', fixtureFile: 'demoCiDataset.entities.enrollments', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci' },
  { entity: 'guardians', fixtureFile: 'demoCiDataset.entities.guardians', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci', notes: '21 guardians linked to narrative students' },
  { entity: 'guardian-links', fixtureFile: 'demoCiDataset.entities.guardianLinks', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci' },
  { entity: 'subjects', fixtureFile: 'demoCiDataset.entities.subjects', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci' },
  { entity: 'subject-matters', fixtureFile: 'demoCiDataset.entities.subjectMatters', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci' },
  { entity: 'class-subjects', fixtureFile: 'demoCiDataset.entities.classSubjects', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci' },
  { entity: 'class-subject-matters', fixtureFile: 'datasets/demo-ci/people.ts', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci' },
  { entity: 'teachers', fixtureFile: 'datasets/demo-ci/teachers.ts', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci', notes: 'Portal teachers (not staff)' },
  { entity: 'teacher-assignments', fixtureFile: 'datasets/demo-ci/teachers.ts', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci' },
  { entity: 'resources', fixtureFile: 'demoCiDataset.entities.resources', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci' },
  { entity: 'schedules', fixtureFile: 'demoCiDataset.entities.schedules', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci', notes: 'Classes 6a, 6b, 5a' },
  { entity: 'lesson-sessions', fixtureFile: 'demoCiDataset.extensions.schedulingSlots', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci', notes: 'Classes 6a, 6b, 5a' },
  { entity: 'staff-assignments', fixtureFile: 'datasets/demo-ci/people.ts', loader: 'run-dev-access-seed', status: 'seeded', dataset: 'demo-ci', notes: 'Homeroom + class-subject teachers' },
  { entity: 'resource-assignments', fixtureFile: 'demoCiDataset.extensions.classResourceAssignments + schedulingSlots', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci', notes: 'Class homeroom resources + lesson-session rooms' },
  { entity: 'class-subject-progress', fixtureFile: 'demoCiDataset.extensions.schedulingSessionProgressAnchor', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci' },
  { entity: 'assessments', fixtureFile: 'demoCiDataset.entities.inClassAssessments + homeworkAssessments', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci', notes: 'In-class + homework; all trimesters' },
  { entity: 'assessment-results', fixtureFile: 'demoCiDataset.extensions.assessmentResultScores + homeworkSubmissions', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci', notes: 'Scores + homework submission compliance' },
  { entity: 'activities', fixtureFile: 'demoCiDataset.entities.activities', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci' },
  { entity: 'activity-enrollments', fixtureFile: 'demoCiDataset.entities.activityEnrollments', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci' },
  { entity: 'calendar-events', fixtureFile: 'demoCiDataset.extensions.calendarEvents', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci' },
  { entity: 'incidents', fixtureFile: 'demoCiDataset.entities.incidents', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci' },
  { entity: 'student-incident-involvements', fixtureFile: 'demoCiDataset.entities.studentIncidentInvolvements', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci' },
  { entity: 'attendance', fixtureFile: 'demoCiDataset.entities.attendanceRecords + extensions.attendanceSessions', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci', notes: 'Absence sessions + reference-date class attendance' },
  { entity: 'student-health-profiles', fixtureFile: 'demoCiDataset.entities.studentHealthProfiles', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci' },
  { entity: 'student-notes', fixtureFile: 'demoCiDataset.entities.studentNotes', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci' },
  { entity: 'catalog-services', fixtureFile: 'demoCiDataset.entities.catalogServices', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci' },
  { entity: 'student-service-enrollments', fixtureFile: 'demoCiDataset.entities.studentServiceEnrollments', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci' },
  { entity: 'payments', fixtureFile: 'demoCiDataset.entities.payments', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci' },
  { entity: 'document-issuances', fixtureFile: 'demoCiDataset.extensions.documentIssuances', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci', notes: 'Ready bulletin, receipt, certificate plus a failed certificate for UI states' },
  { entity: 'grade-scales', fixtureFile: 'demoCiDataset.entities.gradeScales', loader: 'seed-report-cards', status: 'seeded', dataset: 'demo-ci' },
  { entity: 'definitions', fixtureFile: 'demoCiDataset.extensions.reportCardDefinitionFixtures', loader: 'seed-report-cards', status: 'seeded', dataset: 'demo-ci' },
  { entity: 'sections', fixtureFile: 'demoCiDataset.extensions.reportCardDefinitionFixtures', loader: 'seed-report-cards', status: 'seeded', dataset: 'demo-ci' },
  { entity: 'results', fixtureFile: 'demoCiDataset.extensions.reportCardResults', loader: 'seed-report-cards', status: 'seeded', dataset: 'demo-ci', notes: '6a T1–T3 + term-s' },
  { entity: 'staff-permission-assignments', fixtureFile: 'meta/dev-auth-fixtures.ts', loader: 'run-dev-access-seed', status: 'seeded' },
  { entity: 'announcements', fixtureFile: 'demoCiDataset.entities.announcements', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci', notes: 'Published + draft' },
  { entity: 'announcement-targets', fixtureFile: 'demoCiDataset.entities.announcementTargets', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci' },
  { entity: 'message-deliveries', fixtureFile: 'demoCiDataset.entities.messageDeliveries + extensions.announcementMaterializePlans', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci', notes: 'Materialized + explicit statuses' },
  { entity: 'disciplinary-actions', fixtureFile: 'demoCiDataset.entities.disciplinaryActions', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci' },
  { entity: 'student-disciplinary-actions', fixtureFile: 'demoCiDataset.entities.studentDisciplinaryActions', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci', notes: 'Linked to incidents i1–i3' },
  { entity: 'attachments', fixtureFile: 'demoCiDataset.entities.attachments', loader: 'run-dev-school-seed', status: 'seeded', dataset: 'demo-ci', notes: 'Incidents, health, finance, academics' },
  { entity: 'profile-photos', fixtureFile: 'shared/profile-pictures.ts + assets/profile-pictures/pic####.jpg', loader: 'run-dev-school-seed', status: 'seeded', notes: 'Staff, students, guardians via file storage' },
  { entity: 'school-branding', fixtureFile: 'shared/issuance-assets.ts + assets/branding/*.jpg', loader: 'run-dev-school-seed', status: 'seeded', notes: 'Logo/crest allowlisted; stamp/signature restricted' },
] as const satisfies readonly SeedEntityManifestEntryShape[]

export type SeedEntitySlug = (typeof SEED_ENTITY_MANIFEST)[number]['entity']
export type SeedEntityManifestEntry = (typeof SEED_ENTITY_MANIFEST)[number]

export function seedManifestEntitiesByStatus(status: SeedEntityManifestStatus): SeedEntityManifestEntry[] {
  return [...SEED_ENTITY_MANIFEST.filter(entry => entry.status === status)]
}
