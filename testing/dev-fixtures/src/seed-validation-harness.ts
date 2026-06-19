import type { SeedEntityManifestEntry } from './seed-entity-manifest'
import { SEED_ACTIVITY_ENROLLMENTS, SEED_EXTRACURRICULAR_ACTIVITIES } from './activities-seed'
import { countSeedAssessmentResults, countSeedAssessments } from './assessments-seed'
import { countSeedAttachments } from './attachments-seed'
import { countSeedAttendanceRecords } from './attendance-seed'
import { countSeedCalendarEvents } from './calendar-seed'
import {
  countSeedAnnouncements,
  countSeedAnnouncementTargets,
  countSeedMessageDeliveriesMinimum,
} from './communications-seed'
import {
  countSeedGuardians,
  countSeedStudents,
  SEED_ACADEMIC_PERIODS,
  SEED_ACADEMIC_YEAR_ID,
  SEED_CLASS_SUBJECT_MATTERS,
  SEED_CLASS_SUBJECTS,
  SEED_CLASSES,
  SEED_DASHBOARD_ACADEMIC_PERIOD_ID,
  SEED_GRADE_LEVELS,
  SEED_GUARDIANS,
  SEED_INCIDENTS,
  SEED_PEDAGOGICAL_NOTES,
  SEED_PERIOD_DEFINITIONS,
  SEED_RESOURCES,
  SEED_SCHOOL_ID,
  SEED_STAFF,
  SEED_STUDENT_HEALTH_PROFILES,
  SEED_SUBJECT_CATALOG,
  SEED_SUBJECT_MATTERS,
} from './dataset'
import { SEED_REFERENCE_DATE } from './dates'
import { countSeedDisciplinaryActions, countSeedStudentDisciplinaryActions } from './discipline-seed'
import { SEED_FEES, SEED_PAYMENTS, SEED_STUDENT_FEES } from './finance-seed'
import { countSeedHomeworkAssignments, SEED_HOMEWORK_SUBMISSIONS } from './homework-seed'
import { SEED_GRADE_SCALES, SEED_REPORT_CARD_DEFINITIONS, SEED_REPORT_CARD_RESULTS } from './report-cards-seed'
import { countSeedPlanningSlots } from './scheduling-seed'
import { SEED_ENTITY_MANIFEST, seedManifestEntitiesByStatus } from './seed-entity-manifest'
import { SEED_TEACHING_LOG_ENTRIES } from './teaching-log-seed'

/** Maps manifest entity slugs to `SchoolService` / repository keys used by HTTP entity routes. */
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
  'sessions': 'sessions',
  'staff-assignments': 'staffAssignments',
  'resource-assignments': 'resourceAssignments',
  'class-subject-progress': 'classSubjectProgress',
  'assessments': 'assessments',
  'assessment-results': 'assessmentResults',
  'homework-assignments': 'homeworkAssignments',
  'homework-submissions': 'homeworkSubmissions',
  'activities': 'activities',
  'activity-enrollments': 'activityEnrollments',
  'class-logbook-entries': 'classLogbookEntries',
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
  'access-roles': 'accessRoles',
  'staff-role-assignments': 'staffRoleAssignments',
  'announcements': 'announcements',
  'announcement-targets': 'announcementTargets',
  'message-deliveries': 'messageDeliveries',
  'disciplinary-actions': 'disciplinaryActions',
  'student-disciplinary-actions': 'studentDisciplinaryActions',
  'attachments': 'attachments',
}

export interface SeedValidationTarget {
  entity: string
  serviceName: string
  minCount: number
  status: SeedEntityManifestEntry['status']
}

export interface SeedQueryValidationTarget {
  name: string
  path: string
  payload: Record<string, unknown>
  minCount?: number
}

function countSeedGuardianLinks(): number {
  return SEED_GUARDIANS.reduce((total, guardian) => total + guardian.studentIds.length, 0)
}

function countSeedReportCardSections(): number {
  return SEED_REPORT_CARD_DEFINITIONS.reduce((total, definition) => {
    return total + definition.sections.reduce((sectionTotal, section) => {
      return sectionTotal + 1 + section.subjectIds.length
    }, 0)
  }, 0)
}

/** Expected minimum persisted row counts keyed by manifest entity slug. */
export function resolveSeedExpectedCounts(): Record<string, number> {
  return {
    'schools': 1,
    'academic-years': 1,
    'academic-periods': SEED_ACADEMIC_PERIODS.length,
    'grade-levels': SEED_GRADE_LEVELS.length,
    'period-definitions': SEED_PERIOD_DEFINITIONS.length,
    'class-groups': SEED_CLASSES.length,
    'staff-members': SEED_STAFF.length,
    'students': countSeedStudents(),
    'enrollments': countSeedStudents(),
    'guardians': countSeedGuardians(),
    'guardian-links': countSeedGuardianLinks(),
    'subjects': SEED_SUBJECT_CATALOG.length,
    'subject-matters': SEED_SUBJECT_MATTERS.length,
    'class-subjects': SEED_CLASS_SUBJECTS.length,
    'class-subject-matters': SEED_CLASS_SUBJECT_MATTERS.length,
    'resources': SEED_RESOURCES.length,
    'schedules': countSeedPlanningSlots(),
    'sessions': countSeedPlanningSlots(),
    'staff-assignments': 5 + SEED_CLASS_SUBJECTS.length,
    'resource-assignments': 0,
    'class-subject-progress': 1,
    'assessments': countSeedAssessments(),
    'assessment-results': countSeedAssessmentResults(),
    'homework-assignments': countSeedHomeworkAssignments(),
    'homework-submissions': SEED_HOMEWORK_SUBMISSIONS.length,
    'activities': SEED_EXTRACURRICULAR_ACTIVITIES.length,
    'activity-enrollments': SEED_ACTIVITY_ENROLLMENTS.length,
    'class-logbook-entries': SEED_TEACHING_LOG_ENTRIES.length,
    'calendar-events': countSeedCalendarEvents(),
    'incidents': SEED_INCIDENTS.length,
    'student-incident-involvements': SEED_INCIDENTS.length,
    'attendance': countSeedAttendanceRecords(),
    'student-health-profiles': SEED_STUDENT_HEALTH_PROFILES.length,
    'student-notes': SEED_PEDAGOGICAL_NOTES.length,
    'fees': SEED_FEES.length,
    'student-fees': SEED_STUDENT_FEES.length,
    'payments': SEED_PAYMENTS.length,
    'grade-scales': SEED_GRADE_SCALES.length,
    'definitions': SEED_REPORT_CARD_DEFINITIONS.length,
    'sections': countSeedReportCardSections(),
    'results': SEED_REPORT_CARD_RESULTS.length,
    'access-roles': 4,
    'staff-role-assignments': 7,
    'announcements': countSeedAnnouncements(),
    'announcement-targets': countSeedAnnouncementTargets(),
    'message-deliveries': countSeedMessageDeliveriesMinimum(),
    'disciplinary-actions': countSeedDisciplinaryActions(),
    'student-disciplinary-actions': countSeedStudentDisciplinaryActions(),
    'attachments': countSeedAttachments(),
  }
}

export function buildSeedValidationTargets(): SeedValidationTarget[] {
  const counts = resolveSeedExpectedCounts()

  return SEED_ENTITY_MANIFEST
    .filter(entry => entry.status !== 'missing')
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
  return [
    {
      name: 'get-school-overview',
      path: '/core/queries/get-school-overview',
      payload: {
        schoolId: SEED_SCHOOL_ID,
        academicYearId: SEED_ACADEMIC_YEAR_ID,
        academicPeriodId: SEED_DASHBOARD_ACADEMIC_PERIOD_ID,
        referenceDate: SEED_REFERENCE_DATE,
      },
    },
    {
      name: 'get-overdue-fee-count',
      path: '/core/queries/get-overdue-fee-count',
      payload: { schoolId: SEED_SCHOOL_ID },
      minCount: 1,
    },
    {
      name: 'get-published-report-card-count',
      path: '/core/queries/get-published-report-card-count',
      payload: {
        schoolId: SEED_SCHOOL_ID,
        academicYearId: SEED_ACADEMIC_YEAR_ID,
        academicPeriodId: SEED_DASHBOARD_ACADEMIC_PERIOD_ID,
      },
      minCount: 1,
    },
  ]
}

export function assertSeedManifestComplete(): void {
  const missing = seedManifestEntitiesByStatus('missing')
  if (missing.length > 0) {
    throw new Error(`Seed manifest still has missing entities: ${missing.map(entry => entry.entity).join(', ')}`)
  }
}
