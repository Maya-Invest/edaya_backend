import type { SeedEntityManifestStatus } from './entity-manifest'
import { DEMO_CENTRAL_ACADEMIC_YEAR_ID } from '../shared/ids'
import { SEED_DASHBOARD_ACADEMIC_PERIOD_ID, SEED_REFERENCE_DATE } from './dates'
import { SEED_ENTITY_MANIFEST, seedManifestEntitiesByStatus } from './entity-manifest'
import { resolveExpectedCounts } from './fixture-counts'
import { resolveDevSeedContext } from './resolve-dev-seed-context'

/** Maps manifest entity slugs to generated API entity keys used by HTTP validation. */
export const SEED_ENTITY_TO_SERVICE_NAME: Record<string, string> = {
  'schools': 'schools',
  'academic-years': 'academicYears',
  'academic-periods': 'academicPeriods',
  'grade-levels': 'gradeLevels',
  'period-definitions': 'periodDefinitions',
  'class-groups': 'classGroups',
  'staff-members': 'staffMembers',
  'students': 'students',
  'enrollments': 'enrollments',
  'guardians': 'guardians',
  'guardian-links': 'guardianLinks',
  'subjects': 'subjects',
  'subject-matters': 'subjectMatters',
  'class-subjects': 'classSubjects',
  'class-subject-matters': 'classSubjectMatters',
  'resources': 'resources',
  'schedules': 'schedules',
  'lesson-sessions': 'lessonSessions',
  'staff-assignments': 'staffAssignments',
  'resource-assignments': 'resourceAssignments',
  'class-subject-progress': 'classSubjectProgress',
  'assessments': 'assessments',
  'assessment-results': 'assessmentResults',
  'activities': 'activities',
  'activity-enrollments': 'activityEnrollments',
  'calendar-events': 'calendarEvents',
  'incidents': 'incidents',
  'student-incident-involvements': 'studentIncidentInvolvements',
  'attendance': 'attendance',
  'student-health-profiles': 'studentHealthProfiles',
  'student-notes': 'studentNotes',
  'fees': 'fees',
  'student-fees': 'studentFees',
  'payments': 'payments',
  'grade-scales': 'gradeScales',
  'definitions': 'definitions',
  'sections': 'sections',
  'results': 'results',
  'staff-permission-assignments': 'staffPermissionAssignments',
  'announcements': 'announcements',
  'announcement-targets': 'announcementTargets',
  'message-deliveries': 'messageDeliveries',
  'disciplinary-actions': 'disciplinaryActions',
  'student-disciplinary-actions': 'studentDisciplinaryActions',
  'attachments': 'attachments',
  'profile-photos': 'attachments',
}

export interface SeedValidationTarget {
  entity: string
  serviceName: string
  minCount: number
  status: SeedEntityManifestStatus
}

export interface SeedQueryValidationTarget {
  name: string
  path: string
  payload: Record<string, unknown>
  minCount?: number
}

export { resolveExpectedCounts } from './fixture-counts'

export function buildSeedValidationTargets(): SeedValidationTarget[] {
  const context = resolveDevSeedContext()
  const counts = resolveExpectedCounts(context.dataset)

  return SEED_ENTITY_MANIFEST
    .filter(entry => (entry.status as SeedEntityManifestStatus) !== 'missing')
    .map((entry) => {
      const serviceName = SEED_ENTITY_TO_SERVICE_NAME[entry.entity]
      if (!serviceName) {
        throw new Error(`Missing service mapping for manifest entity: ${entry.entity}`)
      }

      const minCount = counts[entry.entity] ?? 1
      return {
        entity: entry.entity,
        serviceName,
        minCount: entry.status === 'partial' && minCount === 0 ? 0 : minCount,
        status: entry.status,
      }
    })
    .filter(target => target.status === 'seeded' || target.minCount > 0)
}

export function buildSeedQueryValidationTargets(): SeedQueryValidationTarget[] {
  const context = resolveDevSeedContext()
  const schoolId = context.schoolId
  const academicYearId = context.dataset.entities.academicYear?.id
    ?? (context.datasetId === 'ci' ? '2025-ci' : DEMO_CENTRAL_ACADEMIC_YEAR_ID)
  const academicPeriodId = context.datasetId === 'ci' ? 'ci-2025-t3' : SEED_DASHBOARD_ACADEMIC_PERIOD_ID
  const expectsFinanceAndReportCards = context.datasetId === 'central'

  return [
    {
      name: 'get-school-overview',
      path: '/core/queries/get-school-overview',
      payload: {
        schoolId,
        academicYearId,
        academicPeriodId,
        referenceDate: SEED_REFERENCE_DATE,
      },
    },
    {
      name: 'get-overdue-fee-count',
      path: '/core/queries/get-overdue-fee-count',
      payload: { schoolId },
      minCount: expectsFinanceAndReportCards ? 1 : 0,
    },
    {
      name: 'get-published-report-card-count',
      path: '/core/queries/get-published-report-card-count',
      payload: {
        schoolId,
        academicYearId,
        academicPeriodId,
      },
      minCount: expectsFinanceAndReportCards ? 1 : 0,
    },
  ]
}

export function assertSeedManifestComplete(): void {
  const missing = seedManifestEntitiesByStatus('missing')
  if (missing.length > 0) {
    throw new Error(`Seed manifest still has missing entities: ${missing.map(entry => entry.entity).join(', ')}`)
  }
}
