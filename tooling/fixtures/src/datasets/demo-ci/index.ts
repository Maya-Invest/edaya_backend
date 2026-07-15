import type { FixtureDataset } from '../types'
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
import { demoCiFees, demoCiPayments, demoCiStudentFees } from './domains/finance'
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
    subjects: demoCiSubjects,
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
    fees: demoCiFees,
    studentFees: demoCiStudentFees,
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
    schedulingSlots: demoCiSchedulingSlots,
    classResourceAssignments: demoCiClassResourceAssignments,
    schedulingSessionProgressAnchors: demoCiSchedulingSessionProgressAnchors,
    calendarEvents: demoCiCalendarEvents,
    reportCardGradeScaleFixtures: demoCiReportCardGradeScaleFixtures,
    reportCardDefinitionFixtures: demoCiReportCardDefinitionFixtures,
    reportCardResults: demoCiReportCardResults,
    announcementMaterializePlans: demoCiAnnouncementMaterializePlans,
  },
} satisfies FixtureDataset<'demo-ci'>
