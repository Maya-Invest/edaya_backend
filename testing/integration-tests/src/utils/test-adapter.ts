import type {
  ActorMetadata,
  SchoolRepositories,
} from '@edaya/core'
import {
  ActorAssuranceLevel,
  createRepositoryAuthorizationPolicy,
  noOpNotificationGateway,
  SchoolApplication,
  StaffMember,
} from '@edaya/core'
import { effectiveGrantsForRoles } from './effective-grants'

export type FailableRepository
  = | 'classSubjectMatterRepository'
    | 'messageDeliveryRepository'
    | 'reportCardResultRepository'
    | 'sessionRepository'
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
  wrapSaveWithFailure('studentFeeRepository', repos.studentFees, getSaveFailure, clearSaveFailure)
  wrapSaveWithFailure('sessionRepository', repos.sessions, getSaveFailure, clearSaveFailure)
  wrapSaveWithFailure('classSubjectMatterRepository', repos.classSubjectMatters, getSaveFailure, clearSaveFailure)
  wrapSaveWithFailure('reportCardResultRepository', repos.results, getSaveFailure, clearSaveFailure)
  wrapSaveWithFailure('studentClassEnrollmentRepository', repos.enrollments, getSaveFailure, clearSaveFailure)
  wrapSaveWithFailure('messageDeliveryRepository', repos.messageDeliveries, getSaveFailure, clearSaveFailure)
}

export function createDefaultTestActor(actor?: ActorMetadata): ActorMetadata {
  return actor ?? {
    kind: 'staff',
    accountKind: 'human',
    actorId: 'admin',
    subjectId: 'admin-user',
    staffMemberId: 'admin',
    schoolId: 'school',
    effectiveGrants: effectiveGrantsForRoles(['admin']),
    requestId: 'integration-test',
    authenticatedAt: new Date('2026-09-01T00:00:00Z'),
    assuranceLevel: ActorAssuranceLevel.Strong,
  }
}

export function buildSchoolApplication(opts: {
  atomicExecution: any
  repositories: any
  actor: ActorMetadata
}) {
  return new SchoolApplication({
    atomicExecution: opts.atomicExecution,
    repositories: opts.repositories,
    notificationGateway: noOpNotificationGateway,
    authorizationPolicy: createRepositoryAuthorizationPolicy({
      repositories: opts.repositories,
      staffAssignmentRepository: opts.repositories.staffAssignments,
      staffMemberRepository: opts.repositories.staffMembers,
      guardianRepository: opts.repositories.guardians,
      guardianStudentLinkRepository: opts.repositories.guardianLinks,
      studentRepository: opts.repositories.students,
    }),
  })
}

export async function seedDefaultStaffMember(repos: any, actor: ActorMetadata) {
  if (actor.kind === 'staff') {
    await repos.staffMembers.save(new StaffMember({
      id: actor.staffMemberId,
      schoolId: actor.schoolId,
      firstName: 'Fixture',
      lastName: 'Administrator',
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
    sessionRepository: repos.sessions,
    assessmentRepository: repos.assessments,
    attendanceRepository: repos.attendance,
    assessmentResultRepository: repos.assessmentResults,
    gradeScaleRepository: repos.gradeScales,
    reportCardDefinitionRepository: repos.definitions,
    reportCardDefinitionSectionRepository: repos.sections,
    reportCardResultRepository: repos.results,
    announcementRepository: repos.announcements,
    announcementTargetRepository: repos.announcementTargets,
    messageDeliveryRepository: repos.messageDeliveries,
    feeRepository: repos.fees,
    studentFeeRepository: repos.studentFees,
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
