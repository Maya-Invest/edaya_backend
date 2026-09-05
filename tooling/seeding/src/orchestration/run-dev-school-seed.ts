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
import type { TeachersSeedPort } from '../domains/teachers/port'
import type { SeedProgressReporter } from '../support/seed-progress'
import type { AuthProvisioner, SeedApplication } from '../support/types'
import { resolveExpectedCounts } from '@edaya/fixtures/meta/fixture-counts'
import { resolveDevSeedContext } from '@edaya/fixtures/meta/resolve-dev-seed-context'
import { syncDevAuthAndGuardianInboxProbes } from '../bootstrap/sync-dev-auth-inbox'
import { createInProcessActivitiesSeedPort } from '../domains/activities/adapters/in-process'
import { seedDevActivities } from '../domains/activities/workflow'
import { createInProcessAssessmentsSeedPort } from '../domains/assessments/adapters/in-process'
import { countDevAssessmentSeedOperations, seedDevAssessments } from '../domains/assessments/workflow'
import { createInProcessAttachmentsSeedPort } from '../domains/attachments/adapters/in-process'
import { seedDevAttachments } from '../domains/attachments/workflow'
import { createInProcessAttendanceSeedPort } from '../domains/attendance/adapters/in-process'
import { seedDevAttendance } from '../domains/attendance/workflow'
import { createInProcessAuthLinkSeedPort } from '../domains/auth-link/adapters/in-process'
import { createInProcessCommunicationsSeedPort } from '../domains/communications/adapters/in-process'
import { seedDevCommunications } from '../domains/communications/workflow'
import { createInProcessCurriculumSeedPort } from '../domains/curriculum/adapters/in-process'
import { seedDevCurriculum } from '../domains/curriculum/workflow'
import { createInProcessDisciplineSeedPort } from '../domains/discipline/adapters/in-process'
import { seedDevDiscipline } from '../domains/discipline/workflow'
import { createInProcessFinanceSeedPort } from '../domains/finance/adapters/in-process'
import { seedDevFinance } from '../domains/finance/workflow'
import { createInProcessPopulationSeedPort } from '../domains/population/adapters/in-process'
import { seedDevPopulation } from '../domains/population/workflow'
import { createInProcessProfilePicturesSeedPort } from '../domains/profile-pictures/adapters/in-process'
import { seedDevProfilePictures } from '../domains/profile-pictures/workflow'
import { createInProcessReportCardsSeedPort } from '../domains/report-cards/adapters/in-process'
import { seedDevReportCards } from '../domains/report-cards/workflow'
import { createInProcessSchedulingSeedPort } from '../domains/scheduling/adapters/in-process'
import { seedDevScheduling } from '../domains/scheduling/workflow'
import { createInProcessSchoolLifeSeedPort } from '../domains/school-life/adapters/in-process'
import { seedDevSchoolLife } from '../domains/school-life/workflow'
import { createInProcessSchoolStructureSeedPort } from '../domains/school-structure/adapters/in-process'
import { inspectDevSchoolStructure, seedDevSchoolStructure } from '../domains/school-structure/workflow'
import { createInProcessStudentSupportSeedPort } from '../domains/student-support/adapters/in-process'
import { seedDevStudentSupport } from '../domains/student-support/workflow'
import { createInProcessTeachersSeedPort } from '../domains/teachers/adapters/in-process'
import { seedDevTeachers } from '../domains/teachers/workflow'
import { buildFixtureCurriculumPlan } from '../support/curriculum-plan'
import { runSeedProgressStep } from '../support/seed-progress'

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
  teachersPort?: TeachersSeedPort
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
  skipProfilePhotos?: boolean
  skipAttachments?: boolean
  progress?: SeedProgressReporter
}

async function runSchoolSeedStep<T>(
  progress: SeedProgressReporter | undefined,
  work: (tick: (by?: number) => void) => Promise<T>,
  options?: { label?: string, total?: number },
): Promise<T> {
  return runSeedProgressStep(progress, work, options)
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
  const teachersPort = options?.teachersPort
    ?? createInProcessTeachersSeedPort(requireSeedApplication(application, 'teachersSeedPort'))
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

  const seedContext = resolveDevSeedContext()
  const seedDataset = seedContext.dataset
  const structureInspection = await inspectDevSchoolStructure(schoolStructurePort, seedDataset)

  if (structureInspection.status === 'skipped') {
    if (options?.auth) {
      await syncDevAuthAndGuardianInboxProbes(
        options.authLinkPort ?? createInProcessAuthLinkSeedPort(
          requireSeedApplication(application, 'authLinkPort'),
        ),
        communicationsPort,
        options.auth,
        options.ownerSubjectId,
      )
    }
    options?.progress?.finish()
    return {
      status: 'skipped',
      reason: 'already-seeded',
      schoolCount: structureInspection.schoolCount,
    }
  }

  let ownerSubjectId = options?.ownerSubjectId
  if (!ownerSubjectId && options?.auth) {
    const ownerAccount = seedContext.staffAccounts.find(
      account => account.staffId === seedContext.ownerStaffId,
    )
    if (ownerAccount) {
      ownerSubjectId = await options.auth.lookupSubjectIdByEmail(ownerAccount.email, seedContext.authPassword)
    }
  }

  await runSchoolSeedStep(options?.progress, async () => {
    await seedDevSchoolStructure(schoolStructurePort, {
      demoSchoolExists: structureInspection.demoSchoolExists,
      ownerSubjectId,
    }, seedDataset)
  })

  await runSchoolSeedStep(options?.progress, async () => {
    await seedDevPopulation(populationPort, seedDataset)
  })
  await runSchoolSeedStep(options?.progress, async () => {
    await seedDevCurriculum(curriculumPort, seedDataset)
  })
  await runSchoolSeedStep(options?.progress, async () => {
    await seedDevTeachers(teachersPort, seedDataset)
  })
  const activitiesCounts = await runSchoolSeedStep(options?.progress, async () =>
    seedDevActivities(activitiesPort, seedDataset))
  await runSchoolSeedStep(options?.progress, async () => {
    await seedDevScheduling(schedulingPort, seedDataset)
  })
  await runSchoolSeedStep(options?.progress, async (tick) => {
    await seedDevAssessments(assessmentsPort, seedDataset, { onProgress: tick })
  }, { total: countDevAssessmentSeedOperations(seedDataset) })
  const schoolLifeCounts = await runSchoolSeedStep(options?.progress, async () =>
    seedDevSchoolLife(schoolLifePort, seedDataset))

  const disciplineCounts = await runSchoolSeedStep(options?.progress, async () =>
    seedDevDiscipline(disciplinePort, seedDataset))

  const attendanceRecordCount = await runSchoolSeedStep(options?.progress, async () =>
    seedDevAttendance(attendancePort, seedDataset))
  const studentSupportCounts = await runSchoolSeedStep(options?.progress, async () =>
    seedDevStudentSupport(studentSupportPort, seedDataset))

  const reportCardCounts = await runSchoolSeedStep(options?.progress, async () =>
    seedDevReportCards(reportCardsPort, seedDataset))
  const financeCounts = await runSchoolSeedStep(options?.progress, async () =>
    seedDevFinance(financePort, seedDataset))

  const communicationsCounts = await runSchoolSeedStep(options?.progress, async () =>
    seedDevCommunications(communicationsPort, seedDataset))
  const attachmentCounts = options?.skipAttachments
    ? { attachments: 0 }
    : await runSchoolSeedStep(options?.progress, async () =>
        seedDevAttachments(attachmentsPort, seedDataset))
  const profilePictureCounts = options?.skipProfilePhotos
    ? { profilePhotos: 0 }
    : await runSchoolSeedStep(options?.progress, async tick =>
        seedDevProfilePictures(profilePicturesPort, {
          apiBaseUrl: options?.apiBaseUrl ?? 'http://localhost:9999',
          onProgress: tick,
        }, seedDataset), {
        total: (seedDataset.entities.staffMembers?.length ?? 0)
          + (seedDataset.entities.students?.length ?? 0)
          + (seedDataset.entities.guardians?.length ?? 0),
      })
  if (options?.auth) {
    await syncDevAuthAndGuardianInboxProbes(
      options.authLinkPort ?? createInProcessAuthLinkSeedPort(
        requireSeedApplication(application, 'authLinkPort'),
      ),
      communicationsPort,
      options.auth,
      ownerSubjectId,
    )
  }

  const entities = seedDataset.entities
  const curriculumPlan = buildFixtureCurriculumPlan(entities)
  const fixtureCounts = resolveExpectedCounts(seedDataset)

  return {
    status: 'seeded',
    schoolId: seedDataset.schoolId,
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
