import type { ActivitiesSeedPort } from '../domains/activities/port'
import type { AssessmentsSeedPort } from '../domains/assessments/port'
import type { AttachmentsSeedPort } from '../domains/attachments/port'
import type { AttendanceSeedPort } from '../domains/attendance/port'
import type { AuthLinkSeedPort } from '../domains/auth-link/port'
import type { CommunicationsSeedPort } from '../domains/communications/port'
import type { CurriculumSeedPort } from '../domains/curriculum/port'
import type { DisciplineSeedPort } from '../domains/discipline/port'
import type { FinanceSeedPort } from '../domains/finance/port'
import type { PopulationSeedPort } from '../domains/population/port'
import type { ProfilePicturesSeedPort } from '../domains/profile-pictures/port'
import type { ReportCardsSeedPort } from '../domains/report-cards/port'
import type { SchedulingSeedPort } from '../domains/scheduling/port'
import type { SchoolLifeSeedPort } from '../domains/school-life/port'
import type { SchoolStructureSeedPort } from '../domains/school-structure/port'
import type { StudentSupportSeedPort } from '../domains/student-support/port'
import type { AuthProvisioner, SeedApplication } from '../support/types'
import { bulkDataset, demoSchoolOwnerStaffId } from '@edaya/fixtures'
import {
  DEV_AUTH_PASSWORD,
  DEV_AUTH_STAFF_ACCOUNTS,
} from '@edaya/fixtures/meta/dev-auth-fixtures'
import { resolveExpectedCounts } from '@edaya/fixtures/meta/fixture-counts'
import { syncDevStaffAuthAndOwner } from '../bootstrap/dev-staff-auth-seed'
import { createInProcessActivitiesSeedPort } from '../domains/activities/in-process'
import { seedDevActivities } from '../domains/activities/workflow'
import { createInProcessAssessmentsSeedPort } from '../domains/assessments/in-process'
import { seedDevAssessments } from '../domains/assessments/workflow'
import { createInProcessAttachmentsSeedPort } from '../domains/attachments/in-process'
import { seedDevAttachments } from '../domains/attachments/workflow'
import { createInProcessAttendanceSeedPort } from '../domains/attendance/in-process'
import { seedDevAttendance } from '../domains/attendance/workflow'
import { createInProcessAuthLinkSeedPort } from '../domains/auth-link/in-process'
import { createInProcessCommunicationsSeedPort } from '../domains/communications/in-process'
import { seedDevCommunications } from '../domains/communications/workflow'
import { createInProcessCurriculumSeedPort } from '../domains/curriculum/in-process'
import { seedDevCurriculum } from '../domains/curriculum/workflow'
import { createInProcessDisciplineSeedPort } from '../domains/discipline/in-process'
import { seedDevDiscipline } from '../domains/discipline/workflow'
import { createInProcessFinanceSeedPort } from '../domains/finance/in-process'
import { seedDevFinance } from '../domains/finance/workflow'
import { createInProcessPopulationSeedPort } from '../domains/population/in-process'
import { seedDevPopulation } from '../domains/population/workflow'
import { createInProcessProfilePicturesSeedPort } from '../domains/profile-pictures/in-process'
import { seedDevProfilePictures } from '../domains/profile-pictures/workflow'
import { createInProcessReportCardsSeedPort } from '../domains/report-cards/in-process'
import { seedDevReportCards } from '../domains/report-cards/workflow'
import { createInProcessSchedulingSeedPort } from '../domains/scheduling/in-process'
import { seedDevScheduling } from '../domains/scheduling/workflow'
import { createInProcessSchoolLifeSeedPort } from '../domains/school-life/in-process'
import { seedDevSchoolLife } from '../domains/school-life/workflow'
import { createInProcessSchoolStructureSeedPort } from '../domains/school-structure/in-process'
import { inspectDevSchoolStructure, seedDevSchoolStructure } from '../domains/school-structure/workflow'
import { createInProcessStudentSupportSeedPort } from '../domains/student-support/in-process'
import { seedDevStudentSupport } from '../domains/student-support/workflow'
import { buildFixtureCurriculumPlan } from '../support/curriculum-plan'

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
      lessonSessions: number
      assessments: number
      assessmentResults: number
      activities: number
      activityEnrollments: number
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
      profilePhotos: number
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
  activitiesPort?: ActivitiesSeedPort
  schoolLifePort?: SchoolLifeSeedPort
  studentSupportPort?: StudentSupportSeedPort
  disciplinePort?: DisciplineSeedPort
  communicationsPort?: CommunicationsSeedPort
  attachmentsPort?: AttachmentsSeedPort
  profilePicturesPort?: ProfilePicturesSeedPort
  /** API origin used to build seeded profile photo URLs. */
  apiBaseUrl?: string
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
  const profilePicturesPort = options?.profilePicturesPort
    ?? createInProcessProfilePicturesSeedPort({
      application: requireSeedApplication(application, 'profilePicturesPort'),
      apiBaseUrl: options?.apiBaseUrl ?? 'http://localhost:9999',
    })
  const structureInspection = await inspectDevSchoolStructure(schoolStructurePort, bulkDataset)

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
      account => account.staffId === demoSchoolOwnerStaffId,
    )
    if (ownerAccount) {
      ownerSubjectId = await options.auth.lookupSubjectIdByEmail(ownerAccount.email, DEV_AUTH_PASSWORD)
    }
  }

  await seedDevSchoolStructure(schoolStructurePort, {
    demoSchoolExists: structureInspection.demoSchoolExists,
    ownerSubjectId,
  }, bulkDataset)

  await seedDevPopulation(populationPort, bulkDataset)
  await seedDevCurriculum(curriculumPort, bulkDataset)
  await seedDevScheduling(schedulingPort, bulkDataset)
  await seedDevAssessments(assessmentsPort, bulkDataset)
  const activitiesCounts = await seedDevActivities(activitiesPort, bulkDataset)
  const schoolLifeCounts = await seedDevSchoolLife(schoolLifePort, bulkDataset)

  const disciplineCounts = await seedDevDiscipline(disciplinePort, bulkDataset)

  const attendanceRecordCount = await seedDevAttendance(attendancePort, bulkDataset)
  const studentSupportCounts = await seedDevStudentSupport(studentSupportPort, bulkDataset)

  const reportCardCounts = await seedDevReportCards(reportCardsPort, bulkDataset)
  const financeCounts = await seedDevFinance(financePort, bulkDataset)

  const communicationsCounts = await seedDevCommunications(communicationsPort, bulkDataset)
  const attachmentCounts = await seedDevAttachments(attachmentsPort, bulkDataset)
  const profilePictureCounts = await seedDevProfilePictures(profilePicturesPort, {
    apiBaseUrl: options?.apiBaseUrl ?? 'http://localhost:9999',
  }, bulkDataset)
  if (options?.auth) {
    await syncDevStaffAuthAndOwner(
      options.authLinkPort ?? createInProcessAuthLinkSeedPort(
        requireSeedApplication(application, 'authLinkPort'),
      ),
      options.auth,
      ownerSubjectId,
    )
  }

  const entities = bulkDataset.entities
  const curriculumPlan = buildFixtureCurriculumPlan(entities)
  const fixtureCounts = resolveExpectedCounts(bulkDataset)

  return {
    status: 'seeded',
    schoolId: bulkDataset.schoolId,
    academicYearId: entities.academicYear?.id ?? '',
    gradeLevels: entities.gradeLevels?.length ?? 0,
    classes: entities.classGroups?.length ?? 0,
    staff: entities.staffMembers?.length ?? 0,
    students: entities.students?.length ?? 0,
    guardians: entities.guardians?.length ?? 0,
    academicPeriods: entities.academicPeriods?.length ?? 0,
    subjects: entities.subjects?.length ?? 0,
    classSubjects: entities.classSubjects?.length ?? 0,
    periodDefinitions: entities.periodDefinitions?.length ?? 0,
    fees: financeCounts.fees,
    studentFees: financeCounts.studentFees,
    payments: financeCounts.payments,
    classSubjectMatters: curriculumPlan.gradeLevelSubjectMatters.length,
    resources: fixtureCounts.resources ?? 0,
    schedules: fixtureCounts.schedules ?? 0,
    lessonSessions: fixtureCounts['lesson-sessions'] ?? 0,
    assessments: fixtureCounts.assessments ?? 0,
    assessmentResults: fixtureCounts['assessment-results'] ?? 0,
    activities: activitiesCounts.activities,
    activityEnrollments: activitiesCounts.activityEnrollments,
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
    profilePhotos: profilePictureCounts.profilePhotos,
  }
}
