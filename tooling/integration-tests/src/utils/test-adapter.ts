import type { ActorMetadata } from '@edaya/authorization'
import type { SchoolRepositories } from '@edaya/service'
import { PostgresCommandJournal } from '@edaya/adaptor-postgres'
import { ActorAssuranceLevel, createStaffActorMetadata } from '@edaya/authorization'
import { noOpFileStorage, noOpNotificationGateway, School, StaffMember } from '@edaya/core'
import { SchoolApplication } from '@edaya/service'

export type FailableRepository
  = | 'classSubjectMatterRepository'
    | 'messageDeliveryRepository'
    | 'reportCardResultRepository'
    | 'lessonSessionRepository'
    | 'studentClassEnrollmentRepository'
    | 'studentFeeRepository'

export function createSaveFailureController() {
  let saveFailure: { repository: FailableRepository, remainingAttempts: number } | undefined

  return {
    failSaveOnAttempt: (repository: FailableRepository, attempt = 1) => {
      saveFailure = { repository, remainingAttempts: attempt }
    },
    getSaveFailure: () => saveFailure,
    clearSaveFailure: () => { saveFailure = undefined },
  }
}

export function wrapSaveWithFailure<T extends { readonly id: string }>(
  repository: FailableRepository,
  store: { save: (entity: T) => Promise<void> },
  getSaveFailure: () => { repository: FailableRepository, remainingAttempts: number } | undefined,
  clearSaveFailure: () => void,
) {
  const originalSave = store.save.bind(store)
  store.save = async (entity: T) => {
    const failure = getSaveFailure()
    if (failure?.repository === repository) {
      failure.remainingAttempts -= 1
      if (failure.remainingAttempts === 0) {
        clearSaveFailure()
        throw new Error(`Simulated ${repository} save failure`)
      }
    }
    await originalSave(entity)
  }
}

export function applyAllSaveFailureWraps(repos: any, getSaveFailure: () => any, clearSaveFailure: () => void) {
  wrapSaveWithFailure('studentFeeRepository', repos.studentCharges, getSaveFailure, clearSaveFailure)
  wrapSaveWithFailure('lessonSessionRepository', repos.lessonSessions, getSaveFailure, clearSaveFailure)
  wrapSaveWithFailure('classSubjectMatterRepository', repos.classSubjectMatters, getSaveFailure, clearSaveFailure)
  wrapSaveWithFailure('reportCardResultRepository', repos.results, getSaveFailure, clearSaveFailure)
  wrapSaveWithFailure('studentClassEnrollmentRepository', repos.enrollments, getSaveFailure, clearSaveFailure)
  wrapSaveWithFailure('messageDeliveryRepository', repos.messageDeliveries, getSaveFailure, clearSaveFailure)
}

export function createDefaultTestActor(actor?: ActorMetadata): ActorMetadata {
  return actor ?? createStaffActorMetadata({
    subjectId: 'admin-user',
    staffMemberId: 'admin',
    schoolId: 'school',
    requestId: 'integration-test',
    authenticatedAt: new Date(),
    assuranceLevel: ActorAssuranceLevel.Strong,
  })
}

export function buildSchoolApplication(opts: {
  atomicExecution: any
  repositories: any
  actor: ActorMetadata
}) {
  return new SchoolApplication({
    atomicExecution: opts.atomicExecution,
    commandJournal: new PostgresCommandJournal(),
    repositories: opts.repositories,
    notificationGateway: noOpNotificationGateway,
    fileStorage: noOpFileStorage,

  })
}

export async function seedDefaultStaffMember(repos: SchoolRepositories, actor: ActorMetadata, owner: boolean) {
  if (actor.kind === 'staff') {
    if (owner) {
      await repos.schools.save(new School({ id: actor.schoolId, name: 'Fixture school', timeZone: 'UTC', ownerSubjectId: actor.subjectId }))
    }
    await repos.staffMembers.save(new StaffMember({
      id: actor.staffMemberId,
      schoolId: actor.schoolId,
      firstName: 'Fixture',
      lastName: 'Administrator',
      accountKind: actor.accountKind,
      ...(actor.accountKind === 'human' ? { subjectId: actor.subjectId } : { serviceId: 'fixture-service' }),
    }))
  }
}

export function buildTestRepositoriesMap(repos: any) {
  return {
    schoolRepository: repos.schools,
    academicYearRepository: repos.academicYears,
    academicPeriodRepository: repos.academicPeriods,
    periodDefinitionRepository: repos.periodDefinitions,
    gradeLevelRepository: repos.gradeLevels,
    classGroupRepository: repos.classGroups,
    studentRepository: repos.students,
    StudentClassEnrollmentRepository: repos.enrollments,
    guardianRepository: repos.guardians,
    guardianStudentLinkRepository: repos.guardianLinks,
    staffMemberRepository: repos.staffMembers,
    staffAssignmentRepository: repos.staffAssignments,
    subjectRepository: repos.subjects,
    subjectMatterRepository: repos.subjectMatters,
    classSubjectRepository: repos.classSubjects,
    classSubjectMatterRepository: repos.classSubjectMatters,
    classSubjectProgressRepository: repos.classSubjectProgress,
    lessonSessionRepository: repos.lessonSessions,
    assessmentRepository: repos.assessments,
    attendanceRepository: repos.attendance,
    assessmentResultRepository: repos.assessmentResults,
    gradeScaleRepository: repos.gradeScales,
    reportModuleRepository: repos.reportModules,
    reportCardResultRepository: repos.results,
    announcementRepository: repos.announcements,
    announcementTargetRepository: repos.announcementTargets,
    messageDeliveryRepository: repos.messageDeliveries,
    catalogServiceRepository: repos.catalogServices,
    studentChargeRepository: repos.studentCharges,
    studentYearAccountRepository: repos.studentYearAccounts,
    studentFeeRepository: repos.studentCharges,
    paymentRepository: repos.payments,
    scheduleRepository: repos.schedules,
    calendarEventRepository: repos.calendarEvents,
    attachmentRepository: repos.attachments,
    resourceRepository: repos.resources,
    resourceAssignmentRepository: repos.resourceAssignments,
    studentNoteRepository: repos.studentNotes,
    studentHealthProfileRepository: repos.studentHealthProfiles,
    studentDisciplinaryActionRepository: repos.studentDisciplinaryActions,
    disciplinaryActionRepository: repos.disciplinaryActions,
    studentIncidentInvolvementRepository: repos.studentIncidentInvolvements,
    incidentRepository: repos.incidents,
  }
}

export interface TestAppResult {
  app: ReturnType<SchoolApplication['forActor']>
  repositories: ReturnType<typeof buildTestRepositoriesMap>
  /** Full `SchoolRepositories` (includes access-control stores). */
  schoolRepositories: SchoolRepositories
  forActor: (actor: ActorMetadata) => ReturnType<SchoolApplication['forActor']>
  failSaveOnAttempt: (repository: FailableRepository, attempt?: number) => void
}

export interface IntegrationTestAdapter {
  createApp: (actor?: ActorMetadata) => Promise<TestAppResult>
}

let activeAdapter: IntegrationTestAdapter | undefined

export function setIntegrationTestAdapter(adapter: IntegrationTestAdapter) {
  activeAdapter = adapter
}

export async function createTestApp(actor?: ActorMetadata): Promise<TestAppResult> {
  if (!activeAdapter) {
    throw new Error('No integration test adapter configured. Call setIntegrationTestAdapter() first.')
  }
  return activeAdapter.createApp(actor)
}
