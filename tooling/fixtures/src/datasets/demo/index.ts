import type { FixtureDataset } from '../types'
import { DEMO_CENTRAL_SCHOOL_ID } from '../../shared/ids'
import { demoActivities, demoActivityEnrollments } from './domains/activities'
import { demoAssessmentResultScores, demoInClassAssessments } from './domains/assessments'
import { demoHomeworkAssessments, demoHomeworkSubmissions } from './domains/assessments-homework'
import { demoAttachments } from './domains/attachments'
import {
  demoAttendanceAbsenceSessions,
  demoAttendanceRecords,
  demoPendingJustificationRecordIds,
  demoTodayAttendanceSession,
} from './domains/attendance'
import { demoCalendarEvents } from './domains/calendar'
import {
  demoAnnouncementMaterializePlans,
  demoAnnouncements,
  demoAnnouncementTargets,
  demoMessageDeliveries,
} from './domains/communications'
import { demoDisciplinaryActions, demoStudentDisciplinaryActions } from './domains/discipline'
import { demoFees, demoPayments, demoStudentFees } from './domains/finance'
import { demoIncidents, demoStudentIncidentInvolvements } from './domains/incidents'
import {
  demoGradeScales,
  demoReportCardDefinitionFixtures,
  demoReportCardGradeScaleFixtures,
  demoReportCardResults,
} from './domains/report-cards'
import {
  demoResources,
  demoSchedules,
  demoSchedulingSessionProgressAnchor,
  demoSchedulingSlots,
} from './domains/scheduling'
import { demoStudentHealthProfiles, demoStudentNotes } from './domains/student-support'
import {
  demoClassSubjectStaffAssignments,
  demoEnrollments,
  demoExtendedClassGroups,
  demoExtendedClassSubjects,
  demoExtendedSubjectMatters,
  demoExtendedSubjects,
  demoGuardianLinks,
  demoGuardians,
  demoPopulationClassSubjects,
  demoStaffMembers,
  demoStudents,
} from './people'
import {
  demoAcademicPeriods,
  demoAcademicYear,
  demoFoundationClassGroups,
  demoFoundationClassSubjects,
  demoFoundationSubjectMatters,
  demoFoundationSubjects,
  demoGradeLevels,
  demoPeriodDefinitions,
  demoSchool,
} from './school'

export const demoDataset = {
  purpose: 'demo',
  schoolId: DEMO_CENTRAL_SCHOOL_ID,
  entities: {
    school: demoSchool,
    academicYear: demoAcademicYear,
    academicPeriods: demoAcademicPeriods,
    gradeLevels: demoGradeLevels,
    periodDefinitions: demoPeriodDefinitions,
    classGroups: [...demoFoundationClassGroups, ...demoExtendedClassGroups],
    staffMembers: demoStaffMembers,
    students: demoStudents,
    enrollments: demoEnrollments,
    guardians: demoGuardians,
    guardianLinks: demoGuardianLinks,
    subjects: [...demoFoundationSubjects, ...demoExtendedSubjects],
    subjectMatters: [...demoFoundationSubjectMatters, ...demoExtendedSubjectMatters],
    classSubjects: [
      ...demoFoundationClassSubjects,
      ...demoExtendedClassSubjects,
      ...demoPopulationClassSubjects,
    ],
    inClassAssessments: demoInClassAssessments,
    homeworkAssessments: demoHomeworkAssessments,
    homeworkSubmissions: demoHomeworkSubmissions,
    attendanceRecords: demoAttendanceRecords,
    activities: demoActivities,
    activityEnrollments: demoActivityEnrollments,
    resources: demoResources,
    schedules: demoSchedules,
    fees: demoFees,
    studentFees: demoStudentFees,
    payments: demoPayments,
    announcements: demoAnnouncements,
    announcementTargets: demoAnnouncementTargets,
    messageDeliveries: demoMessageDeliveries,
    incidents: demoIncidents,
    studentIncidentInvolvements: demoStudentIncidentInvolvements,
    disciplinaryActions: demoDisciplinaryActions,
    studentDisciplinaryActions: demoStudentDisciplinaryActions,
    gradeScales: demoGradeScales,
    attachments: demoAttachments,
    studentHealthProfiles: demoStudentHealthProfiles,
    studentNotes: demoStudentNotes,
  },
  extensions: {
    assessmentResultScores: demoAssessmentResultScores,
    attendanceSessions: {
      absenceSessions: demoAttendanceAbsenceSessions,
      todaySession: demoTodayAttendanceSession,
      pendingJustificationRecordIds: demoPendingJustificationRecordIds,
    },
    schedulingSlots: demoSchedulingSlots,
    schedulingSessionProgressAnchor: demoSchedulingSessionProgressAnchor,
    calendarEvents: demoCalendarEvents,
    reportCardGradeScaleFixtures: demoReportCardGradeScaleFixtures,
    reportCardDefinitionFixtures: demoReportCardDefinitionFixtures,
    reportCardResults: demoReportCardResults,
    announcementMaterializePlans: demoAnnouncementMaterializePlans,
    classSubjectStaffAssignments: demoClassSubjectStaffAssignments,
  },
} satisfies FixtureDataset<'demo'>
