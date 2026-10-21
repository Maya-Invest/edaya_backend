import type { FixtureDataset } from '../types'
import {
  DEMO_CI_DASHBOARD_ACADEMIC_PERIOD_ID,
  DEMO_CI_SCHEDULING_REFERENCE_WEEK_START,
  DEMO_CI_SEED_REFERENCE_DATE,
} from '../../meta/dates'
import { DEMO_CI_SCHOOL_ID } from '../../shared/ids'
import { demoCiActivities, demoCiActivityEnrollments, demoCiClassActivityEnrollments } from './domains/activities'
import {
  demoCiAssessmentResultScores,
  demoCiInClassAssessments,
} from './domains/assessments'
import { demoCiHomeworkAssessments, demoCiHomeworkSubmissions } from './domains/assessments-homework'
import { demoCiAttachments } from './domains/attachments'
import {
  demoCiAttendanceAbsenceSessions,
  demoCiAttendanceRecords,
  demoCiDailyAttendanceDays,
  demoCiPendingJustificationRecordIds,
  demoCiTodayAttendanceSession,
} from './domains/attendance'
import { demoCiCalendarEvents } from './domains/calendar'
import {
  demoCiAnnouncementMaterializePlans,
  demoCiAnnouncements,
  demoCiAnnouncementTargets,
  demoCiMessageDeliveries,
} from './domains/communications'
import { demoCiDisciplinaryActions, demoCiStudentDisciplinaryActions } from './domains/discipline'
import { demoCiDocumentIssuances } from './domains/documents'
import { demoCiCatalogServices, demoCiPayments, demoCiStudentServiceEnrollments } from './domains/finance'
import { demoCiIncidents, demoCiStudentIncidentInvolvements } from './domains/incidents'
import {
  demoCiGradeScales,
  demoCiReportCardDefinitionFixtures,
  demoCiReportCardGradeScaleFixtures,
  demoCiReportCardResults,
} from './domains/report-cards'
import {
  demoCiClassResourceAssignments,
  demoCiResources,
  demoCiSchedules,
  demoCiSchedulingSessionProgressAnchors,
  demoCiSchedulingSlots,
} from './domains/scheduling'
import { demoCiStudentHealthProfiles, demoCiStudentNotes } from './domains/student-support'
import {
  demoCiEnrollments,
  demoCiGuardianLinks,
  demoCiGuardians,
  demoCiStaffMembers,
  demoCiStudents,
} from './people'
import {
  demoCiAcademicPeriods,
  demoCiAcademicYear,
  demoCiClassGroups,
  demoCiClassSubjects,
  demoCiGradeLevels,
  demoCiPeriodDefinitions,
  demoCiSchool,
  demoCiSubjectMatters,
  demoCiSubjects,
} from './school'
import { demoCiTeacherAssignments, demoCiTeachers } from './teachers'

export const demoCiDataset = {
  purpose: 'demo-ci',
  schoolId: DEMO_CI_SCHOOL_ID,
  entities: {
    school: demoCiSchool,
    academicYear: demoCiAcademicYear,
    academicPeriods: demoCiAcademicPeriods,
    gradeLevels: demoCiGradeLevels,
    periodDefinitions: demoCiPeriodDefinitions,
    classGroups: demoCiClassGroups,
    staffMembers: demoCiStaffMembers,
    teachers: demoCiTeachers,
    teacherAssignments: demoCiTeacherAssignments,
    students: demoCiStudents,
    enrollments: demoCiEnrollments,
    guardians: demoCiGuardians,
    guardianLinks: demoCiGuardianLinks,
    academicDisciplines: [{ id: 'ci-discipline-demo', schoolId: DEMO_CI_SCHOOL_ID, code: 'DEMO', name: 'Demonstration curriculum' }],
    subjects: demoCiSubjects.map(subject => ({ ...subject, disciplineId: 'ci-discipline-demo' })),
    subjectMatters: demoCiSubjectMatters,
    classSubjects: demoCiClassSubjects,
    resources: demoCiResources,
    schedules: demoCiSchedules,
    gradeScales: demoCiGradeScales,
    inClassAssessments: demoCiInClassAssessments,
    homeworkAssessments: demoCiHomeworkAssessments,
    homeworkSubmissions: demoCiHomeworkSubmissions,
    attendanceRecords: demoCiAttendanceRecords,
    activities: demoCiActivities,
    activityEnrollments: demoCiActivityEnrollments,
    classActivityEnrollments: demoCiClassActivityEnrollments,
    catalogServices: demoCiCatalogServices,
    studentServiceEnrollments: demoCiStudentServiceEnrollments,
    payments: demoCiPayments,
    announcements: demoCiAnnouncements,
    announcementTargets: demoCiAnnouncementTargets,
    messageDeliveries: demoCiMessageDeliveries,
    incidents: demoCiIncidents,
    studentIncidentInvolvements: demoCiStudentIncidentInvolvements,
    disciplinaryActions: demoCiDisciplinaryActions,
    studentDisciplinaryActions: demoCiStudentDisciplinaryActions,
    attachments: demoCiAttachments,
    studentHealthProfiles: demoCiStudentHealthProfiles,
    studentNotes: demoCiStudentNotes,
  },
  extensions: {
    assessmentResultScores: demoCiAssessmentResultScores,
    attendanceSessions: {
      absenceSessions: demoCiAttendanceAbsenceSessions,
      todaySession: demoCiTodayAttendanceSession,
      pendingJustificationRecordIds: demoCiPendingJustificationRecordIds,
    },
    dailyAttendanceDays: demoCiDailyAttendanceDays,
    schedulingSlots: demoCiSchedulingSlots,
    classResourceAssignments: demoCiClassResourceAssignments,
    schedulingSessionProgressAnchors: demoCiSchedulingSessionProgressAnchors,
    calendarEvents: demoCiCalendarEvents,
    reportCardGradeScaleFixtures: demoCiReportCardGradeScaleFixtures,
    reportCardDefinitionFixtures: demoCiReportCardDefinitionFixtures,
    reportCardResults: demoCiReportCardResults,
    announcementMaterializePlans: demoCiAnnouncementMaterializePlans,
    documentIssuances: demoCiDocumentIssuances,
    publishAcademicPeriodIds: [DEMO_CI_DASHBOARD_ACADEMIC_PERIOD_ID],
    schedulingReferenceWeekStart: DEMO_CI_SCHEDULING_REFERENCE_WEEK_START,
    seedReferenceDate: DEMO_CI_SEED_REFERENCE_DATE,
  },
} satisfies FixtureDataset<'demo-ci'>
