import type {
  PostgresSchoolRepositories,
} from '@edaya/adaptor-postgres-json'
import type {
  ActorMetadata,
} from '@edaya/core'
import {
  PostgresAtomicExecution,
} from '@edaya/adaptor-postgres-json'
import {
  ActorAssuranceLevel,
  RepositoryAuthorizationPolicy,
  SchoolApplication,
  StaffMember,
  StaffRole,
} from '@edaya/core'

export type FailableRepository
  = | 'classSubjectMatterRepository'
    | 'messageDeliveryRepository'
    | 'reportCardResultRepository'
    | 'sessionRepository'
    | 'studentClassEnrollmentRepository'
    | 'studentFeeRepository'

export function createPostgresAppBuilder(db: any, repos: PostgresSchoolRepositories) {
  return (actor?: ActorMetadata) => {
    let saveFailure: { repository: FailableRepository, remainingAttempts: number } | undefined
    const failSaveOnAttempt = (repository: FailableRepository, attempt = 1) => {
      saveFailure = { repository, remainingAttempts: attempt }
    }

    const wrapSaveWithFailure = <T extends { readonly id: string }>(
      repository: FailableRepository,
      store: { save: (entity: T) => Promise<void> },
    ) => {
      const originalSave = store.save.bind(store)
      store.save = async (entity: T) => {
        if (saveFailure?.repository === repository) {
          saveFailure.remainingAttempts -= 1
          if (saveFailure.remainingAttempts === 0) {
            saveFailure = undefined
            throw new Error(`Simulated ${repository} save failure`)
          }
        }
        await originalSave(entity)
      }
    }

    wrapSaveWithFailure('studentFeeRepository', repos.studentFees)
    wrapSaveWithFailure('sessionRepository', repos.sessions)
    wrapSaveWithFailure('classSubjectMatterRepository', repos.classSubjectMatters)
    wrapSaveWithFailure('reportCardResultRepository', repos.results)
    wrapSaveWithFailure('studentClassEnrollmentRepository', repos.enrollments)
    wrapSaveWithFailure('messageDeliveryRepository', repos.messageDeliveries)

    const defaultActor = actor ?? {
      kind: 'staff',
      subjectId: 'admin-user',
      staffMemberId: 'admin',
      schoolId: 'school',
      roles: [StaffRole.Admin],
      requestId: 'integration-test',
      authenticatedAt: new Date('2026-09-01T00:00:00Z'),
      assuranceLevel: ActorAssuranceLevel.Strong,
    }

    const application = new SchoolApplication({
      atomicExecution: new PostgresAtomicExecution(db),
      repositories: repos,
      authorizationPolicy: new RepositoryAuthorizationPolicy({
        repositories: repos,
        staffAssignmentRepository: repos.staffAssignments,
        staffMemberRepository: repos.staffMembers,
        guardianRepository: repos.guardians,
        guardianStudentLinkRepository: repos.guardianLinks,
        studentRepository: repos.students,
      }),
      actor: defaultActor,
    })

    if (defaultActor.kind === 'staff') {
      void repos.staffMembers.save(new StaffMember({
        id: defaultActor.staffMemberId,
        schoolId: defaultActor.schoolId,
        firstName: 'Fixture',
        lastName: 'Administrator',
        roles: defaultActor.roles,
      }))
    }

    const testRepositories = {
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

    return {
      app: application.forActor(defaultActor),
      repositories: testRepositories,
      forActor: (boundActor: ActorMetadata) => application.forActor(boundActor),
      failSaveOnAttempt,
    } as any
  }
}
