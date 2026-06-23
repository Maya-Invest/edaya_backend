import type { ActivitiesSeedPort } from './activities/port'
import type { AssessmentsSeedPort } from './assessments/port'
import type { AttachmentsSeedPort } from './attachments/port'
import type { AttendanceSeedPort } from './attendance/port'
import type { AuthLinkSeedPort } from './auth-link/port'
import type { CommunicationsSeedPort } from './communications/port'
import type { CurriculumSeedPort } from './curriculum/port'
import type { DisciplineSeedPort } from './discipline/port'
import type { FinanceSeedPort } from './finance/port'
import type { LearningContentSeedPort } from './learning-content/port'
import type { PopulationSeedPort } from './population/port'
import type { ReportCardsSeedPort } from './report-cards/port'
import type { SchedulingSeedPort } from './scheduling/port'
import type { SchoolLifeSeedPort } from './school-life/port'
import type { SchoolStructureSeedPort } from './school-structure/port'
import type { StudentSupportSeedPort } from './student-support/port'
import type { AuthProvisioner, SeedApplication } from './types'
import {
  countSeedAssessmentResults,
  countSeedAssessments,
  countSeedPlanningSlots,
  DEV_AUTH_PASSWORD,
  DEV_AUTH_STAFF_ACCOUNTS,
  SEED_ACADEMIC_PERIODS,
  SEED_ACADEMIC_YEAR_ID,
  SEED_CLASS_SUBJECT_MATTERS,
  SEED_CLASS_SUBJECTS,
  SEED_CLASSES,
  SEED_GRADE_LEVELS,
  SEED_GUARDIANS,
  SEED_PERIOD_DEFINITIONS,
  SEED_RESOURCES,
  SEED_SCHOOL_ID,
  SEED_SCHOOL_OWNER_STAFF_ID,
  SEED_STAFF,
  SEED_STUDENTS,
  SEED_SUBJECT_CATALOG,
} from '@edaya/dev-fixtures'
import { createInProcessActivitiesSeedPort } from './activities/in-process'
import { seedDevActivities } from './activities/workflow'
import { createInProcessAssessmentsSeedPort } from './assessments/in-process'
import { seedDevAssessments } from './assessments/workflow'
import { createInProcessAttachmentsSeedPort } from './attachments/in-process'
import { seedDevAttachments } from './attachments/workflow'
import { createInProcessAttendanceSeedPort } from './attendance/in-process'
import { seedDevAttendance } from './attendance/workflow'
import { createInProcessAuthLinkSeedPort } from './auth-link/in-process'
import { createInProcessCommunicationsSeedPort } from './communications/in-process'
import { seedDevCommunications } from './communications/workflow'
import { createInProcessCurriculumSeedPort } from './curriculum/in-process'
import { seedDevCurriculum } from './curriculum/workflow'
import { syncDevStaffAuthAndOwner } from './dev-staff-auth-seed'
import { createInProcessDisciplineSeedPort } from './discipline/in-process'
import { seedDevDiscipline } from './discipline/workflow'
import { createInProcessFinanceSeedPort } from './finance/in-process'
import { seedDevFinance } from './finance/workflow'
import { createInProcessLearningContentSeedPort } from './learning-content/in-process'
import { seedDevLearningContent } from './learning-content/workflow'
import { createInProcessPopulationSeedPort } from './population/in-process'
import { seedDevPopulation } from './population/workflow'
import { createInProcessReportCardsSeedPort } from './report-cards/in-process'
import { seedDevReportCards } from './report-cards/workflow'
import { createInProcessSchedulingSeedPort } from './scheduling/in-process'
import { seedDevScheduling } from './scheduling/workflow'
import { createInProcessSchoolLifeSeedPort } from './school-life/in-process'
import { seedDevSchoolLife } from './school-life/workflow'
import { createInProcessSchoolStructureSeedPort } from './school-structure/in-process'
import { inspectDevSchoolStructure, seedDevSchoolStructure } from './school-structure/workflow'
import { createInProcessStudentSupportSeedPort } from './student-support/in-process'
import { seedDevStudentSupport } from './student-support/workflow'

export type DevSchoolSeedResult
  = | { status: 'skipped', reason: 'already-seeded', schoolCount: number }
    | {
      status: 'seeded'
      schoolId: string
      academicYearId: string
      gradeLevels: number
      classes: number
      staff: number
      students: number
      guardians: number
      academicPeriods: number
      subjects: number
      classSubjects: number
      periodDefinitions: number
      fees: number
      studentFees: number
      payments: number
      classSubjectMatters: number
      resources: number
      schedules: number
      sessions: number
      assessments: number
      assessmentResults: number
      homeworkAssignments: number
      homeworkSubmissions: number
      activities: number
      activityEnrollments: number
      classLogbookEntries: number
      calendarEvents: number
      incidents: number
      attendanceRecords: number
      studentHealthProfiles: number
      studentNotes: number
      gradeScales: number
      reportCardDefinitions: number
      reportCardSections: number
      reportCardResults: number
      disciplinaryActions: number
      studentDisciplinaryActions: number
      announcements: number
      announcementTargets: number
      messageDeliveries: number
      attachments: number
    }

export interface RunDevSchoolSeedOptions {
  ownerSubjectId?: string
  auth?: AuthProvisioner
  authLinkPort?: AuthLinkSeedPort
  schoolStructurePort?: SchoolStructureSeedPort
  populationPort?: PopulationSeedPort
  curriculumPort?: CurriculumSeedPort
  schedulingPort?: SchedulingSeedPort
  attendancePort?: AttendanceSeedPort
  assessmentsPort?: AssessmentsSeedPort
  reportCardsPort?: ReportCardsSeedPort
  financePort?: FinanceSeedPort
  learningContentPort?: LearningContentSeedPort
  activitiesPort?: ActivitiesSeedPort
  schoolLifePort?: SchoolLifeSeedPort
  studentSupportPort?: StudentSupportSeedPort
  disciplinePort?: DisciplineSeedPort
  communicationsPort?: CommunicationsSeedPort
  attachmentsPort?: AttachmentsSeedPort
}

function requireSeedApplication(
  application: SeedApplication | undefined,
  portName: string,
): SeedApplication {
  if (!application) {
    throw new Error(`${portName} must be provided when no in-process seed application is available`)
  }
  return application
}

export async function runDevSchoolSeed(
  application: SeedApplication | undefined,
  options?: RunDevSchoolSeedOptions,
): Promise<DevSchoolSeedResult> {
  const schoolStructurePort = options?.schoolStructurePort
    ?? createInProcessSchoolStructureSeedPort(requireSeedApplication(application, 'schoolStructurePort'))
  const populationPort = options?.populationPort
    ?? createInProcessPopulationSeedPort(requireSeedApplication(application, 'populationPort'))
  const curriculumPort = options?.curriculumPort
    ?? createInProcessCurriculumSeedPort(requireSeedApplication(application, 'curriculumPort'))
  const schedulingPort = options?.schedulingPort
    ?? createInProcessSchedulingSeedPort(requireSeedApplication(application, 'schedulingPort'))
  const attendancePort = options?.attendancePort
    ?? createInProcessAttendanceSeedPort(requireSeedApplication(application, 'attendancePort'))
  const assessmentsPort = options?.assessmentsPort
    ?? createInProcessAssessmentsSeedPort(requireSeedApplication(application, 'assessmentsPort'))
  const reportCardsPort = options?.reportCardsPort
    ?? createInProcessReportCardsSeedPort(requireSeedApplication(application, 'reportCardsPort'))
  const financePort = options?.financePort
    ?? createInProcessFinanceSeedPort(requireSeedApplication(application, 'financePort'))
  const learningContentPort = options?.learningContentPort
    ?? createInProcessLearningContentSeedPort(requireSeedApplication(application, 'learningContentPort'))
  const activitiesPort = options?.activitiesPort
    ?? createInProcessActivitiesSeedPort(requireSeedApplication(application, 'activitiesPort'))
  const schoolLifePort = options?.schoolLifePort
    ?? createInProcessSchoolLifeSeedPort(requireSeedApplication(application, 'schoolLifePort'))
  const studentSupportPort = options?.studentSupportPort
    ?? createInProcessStudentSupportSeedPort(requireSeedApplication(application, 'studentSupportPort'))
  const disciplinePort = options?.disciplinePort
    ?? createInProcessDisciplineSeedPort(requireSeedApplication(application, 'disciplinePort'))
  const communicationsPort = options?.communicationsPort
    ?? createInProcessCommunicationsSeedPort(requireSeedApplication(application, 'communicationsPort'))
  const attachmentsPort = options?.attachmentsPort
    ?? createInProcessAttachmentsSeedPort(requireSeedApplication(application, 'attachmentsPort'))
  const structureInspection = await inspectDevSchoolStructure(schoolStructurePort)

  if (structureInspection.status === 'skipped') {
    if (options?.auth) {
      await syncDevStaffAuthAndOwner(
        options.authLinkPort ?? createInProcessAuthLinkSeedPort(
          requireSeedApplication(application, 'authLinkPort'),
        ),
        options.auth,
        options.ownerSubjectId,
      )
    }
    return {
      status: 'skipped',
      reason: 'already-seeded',
      schoolCount: structureInspection.schoolCount,
    }
  }

  let ownerSubjectId = options?.ownerSubjectId
  if (!ownerSubjectId && options?.auth) {
    const ownerAccount = DEV_AUTH_STAFF_ACCOUNTS.find(
      account => account.staffId === SEED_SCHOOL_OWNER_STAFF_ID,
    )
    if (ownerAccount) {
      ownerSubjectId = await options.auth.lookupSubjectIdByEmail(ownerAccount.email, DEV_AUTH_PASSWORD)
    }
  }

  await seedDevSchoolStructure(schoolStructurePort, {
    demoSchoolExists: structureInspection.demoSchoolExists,
    ownerSubjectId,
  })

  await seedDevPopulation(populationPort)
  await seedDevCurriculum(curriculumPort)
  await seedDevScheduling(schedulingPort)
  await seedDevAssessments(assessmentsPort)
  const learningContentCounts = await seedDevLearningContent(learningContentPort)
  const activitiesCounts = await seedDevActivities(activitiesPort)
  const schoolLifeCounts = await seedDevSchoolLife(schoolLifePort)

  const disciplineCounts = await seedDevDiscipline(disciplinePort)

  const attendanceRecordCount = await seedDevAttendance(attendancePort)
  const studentSupportCounts = await seedDevStudentSupport(studentSupportPort)

  const reportCardCounts = await seedDevReportCards(reportCardsPort)
  const financeCounts = await seedDevFinance(financePort)

  const communicationsCounts = await seedDevCommunications(communicationsPort)
  const attachmentCounts = await seedDevAttachments(attachmentsPort)
  if (options?.auth) {
    await syncDevStaffAuthAndOwner(
      options.authLinkPort ?? createInProcessAuthLinkSeedPort(
        requireSeedApplication(application, 'authLinkPort'),
      ),
      options.auth,
      ownerSubjectId,
    )
  }

  return {
    status: 'seeded',
    schoolId: SEED_SCHOOL_ID,
    academicYearId: SEED_ACADEMIC_YEAR_ID,
    gradeLevels: SEED_GRADE_LEVELS.length,
    classes: SEED_CLASSES.length,
    staff: SEED_STAFF.length,
    students: SEED_STUDENTS.length,
    guardians: SEED_GUARDIANS.length,
    academicPeriods: SEED_ACADEMIC_PERIODS.length,
    subjects: SEED_SUBJECT_CATALOG.length,
    classSubjects: SEED_CLASS_SUBJECTS.length,
    periodDefinitions: SEED_PERIOD_DEFINITIONS.length,
    fees: financeCounts.fees,
    studentFees: financeCounts.studentFees,
    payments: financeCounts.payments,
    classSubjectMatters: SEED_CLASS_SUBJECT_MATTERS.length,
    resources: SEED_RESOURCES.length,
    schedules: countSeedPlanningSlots(),
    sessions: countSeedPlanningSlots(),
    assessments: countSeedAssessments(),
    assessmentResults: countSeedAssessmentResults(),
    homeworkAssignments: learningContentCounts.homeworkAssignments,
    homeworkSubmissions: learningContentCounts.homeworkSubmissions,
    activities: activitiesCounts.activities,
    activityEnrollments: activitiesCounts.activityEnrollments,
    classLogbookEntries: learningContentCounts.classLogbookEntries,
    calendarEvents: schoolLifeCounts.calendarEvents,
    incidents: schoolLifeCounts.incidents,
    attendanceRecords: attendanceRecordCount,
    studentHealthProfiles: studentSupportCounts.studentHealthProfiles,
    studentNotes: studentSupportCounts.studentNotes,
    gradeScales: reportCardCounts.gradeScales,
    reportCardDefinitions: reportCardCounts.definitions,
    reportCardSections: reportCardCounts.sections,
    reportCardResults: reportCardCounts.results,
    disciplinaryActions: disciplineCounts.disciplinaryActions,
    studentDisciplinaryActions: disciplineCounts.studentDisciplinaryActions,
    announcements: communicationsCounts.announcements,
    announcementTargets: communicationsCounts.announcementTargets,
    messageDeliveries: communicationsCounts.messageDeliveries,
    attachments: attachmentCounts.attachments,
  }
}
