import type {
  AcademicPeriod,
  AcademicYear,
  Announcement,
  AnnouncementTarget,
  Assessment,
  AttendanceRecord,
  CalendarEvent,
  ClassGroup,
  ClassSubject,
  ClassSubjectMatter,
  ClassSubjectProgress,
  Fee,
  Grade,
  GradeLevel,
  GradeScale,
  GroupedSession,
  Guardian,
  GuardianStudentLink,
  MessageDelivery,
  Payment,
  PeriodDefinition,
  ReportCardDefinition,
  ReportCardDefinitionSection,
  ReportCardResult,
  Schedule,
  School,
  Session,
  StaffAssignment,
  Student,
  StudentClassEnrollment,
  StudentFee,
  Subject,
  SubjectMatter,
} from '../../src/entities'
import type { BaseRepositoryInterface } from '../../src/ports'
import type { SchoolHeadlessApp, SchoolHeadlessAppDependencies } from '../../src/school-headless-app'
import type { ActorMetadata } from '../../src/services/authorization'
import { StaffMember, StaffRole } from '../../src/entities'
import { SchoolApplication } from '../../src/school-headless-app'
import {
  createStaffActorMetadata,
  RepositoryAuthorizationPolicy,
} from '../../src/services/authorization'

interface EntityWithId {
  readonly id: string
}

interface TransactionParticipant {
  begin: () => void
  commit: () => void
  rollback: () => void
}

export function createStore<T extends EntityWithId>(participants: TransactionParticipant[] = []) {
  const entries = new Map<string, T>()
  let snapshot: Map<string, T> | undefined
  participants.push({
    begin: () => {
      snapshot = new Map(entries)
    },
    commit: () => {
      snapshot = undefined
    },
    rollback: () => {
      entries.clear()
      for (const [id, entity] of snapshot ?? []) {
        entries.set(id, entity)
      }
      snapshot = undefined
    },
  })
  return {
    findById: async (id: string) => entries.get(id),
    list: async () => [...entries.values()],
    save: async (entity: T) => {
      entries.set(entity.id, entity)
    },
    delete: async (entity: T) => {
      entries.delete(entity.id)
    },
    count: async () => entries.size,
  }
}

function createAtomicExecution(participants: readonly TransactionParticipant[]) {
  return {
    execute: async <T>(operation: () => Promise<T>): Promise<T> => {
      for (const participant of participants) {
        participant.begin()
      }
      try {
        const result = await operation()
        for (const participant of participants) {
          participant.commit()
        }
        return result
      }
      catch (error) {
        for (const participant of participants) {
          participant.rollback()
        }
        throw error
      }
    },
  }
}

export type FailableRepository
  = | 'classSubjectMatterRepository'
    | 'reportCardResultRepository'
    | 'sessionRepository'
    | 'studentFeeRepository'

export function createTestApp(actor?: ActorMetadata): {
  app: SchoolHeadlessApp
  repositories: SchoolHeadlessAppDependencies
  forActor: (actor: ActorMetadata) => SchoolHeadlessApp
  failSaveOnAttempt: (repository: FailableRepository, attempt?: number) => void
} {
  const transactionParticipants: TransactionParticipant[] = []
  let saveFailure: { repository: FailableRepository, remainingAttempts: number } | undefined
  const failSaveOnAttempt = (repository: FailableRepository, attempt = 1) => {
    saveFailure = { repository, remainingAttempts: attempt }
  }
  const saveWithFailure = async <T extends EntityWithId>(
    repository: FailableRepository,
    store: BaseRepositoryInterface<T>,
    entity: T,
  ): Promise<void> => {
    if (saveFailure?.repository === repository) {
      saveFailure.remainingAttempts -= 1
      if (saveFailure.remainingAttempts === 0) {
        saveFailure = undefined
        throw new Error(`Simulated ${repository} save failure`)
      }
    }
    await store.save(entity)
  }

  const schools = createStore<School>(transactionParticipants)
  const academicYears = createStore<AcademicYear>(transactionParticipants)
  const academicPeriods = createStore<AcademicPeriod>(transactionParticipants)
  const periodDefinitions = createStore<PeriodDefinition>(transactionParticipants)
  const gradeLevels = createStore<GradeLevel>(transactionParticipants)
  const classGroups = createStore<ClassGroup>(transactionParticipants)
  const students = createStore<Student>(transactionParticipants)
  const enrollments = createStore<StudentClassEnrollment>(transactionParticipants)
  const guardians = createStore<Guardian>(transactionParticipants)
  const guardianLinks = createStore<GuardianStudentLink>(transactionParticipants)
  const staffMembers = createStore<StaffMember>(transactionParticipants)
  const staffAssignments = createStore<StaffAssignment>(transactionParticipants)
  const subjects = createStore<Subject>(transactionParticipants)
  const subjectMatters = createStore<SubjectMatter>(transactionParticipants)
  const classSubjects = createStore<ClassSubject>(transactionParticipants)
  const classSubjectMatters = createStore<ClassSubjectMatter>(transactionParticipants)
  const classSubjectProgress = createStore<ClassSubjectProgress>(transactionParticipants)
  const sessions = createStore<Session>(transactionParticipants)
  const groupedSessions = createStore<GroupedSession>(transactionParticipants)
  const assessments = createStore<Assessment>(transactionParticipants)
  const attendance = createStore<AttendanceRecord>(transactionParticipants)
  const grades = createStore<Grade>(transactionParticipants)
  const gradeScales = createStore<GradeScale>(transactionParticipants)
  const definitions = createStore<ReportCardDefinition>(transactionParticipants)
  const sections = createStore<ReportCardDefinitionSection>(transactionParticipants)
  const results = createStore<ReportCardResult>(transactionParticipants)
  const announcements = createStore<Announcement>(transactionParticipants)
  const announcementTargets = createStore<AnnouncementTarget>(transactionParticipants)
  const messageDeliveries = createStore<MessageDelivery>(transactionParticipants)
  const fees = createStore<Fee>(transactionParticipants)
  const studentFees = createStore<StudentFee>(transactionParticipants)
  const payments = createStore<Payment>(transactionParticipants)
  const schedules = createStore<Schedule>(transactionParticipants)
  const calendarEvents = createStore<CalendarEvent>(transactionParticipants)

  const repositories: SchoolHeadlessAppDependencies = {
    atomicExecution: createAtomicExecution(transactionParticipants),
    schoolRepository: schools,
    academicYearRepository: {
      ...academicYears,
      listBySchool: async schoolId => (await academicYears.list()).filter(item => item.schoolId === schoolId),
    },
    academicPeriodRepository: {
      ...academicPeriods,
      listByAcademicYear: async academicYearId =>
        (await academicPeriods.list()).filter(item => item.academicYearId === academicYearId),
      listBySchool: async schoolId => (await academicPeriods.list()).filter(item => item.schoolId === schoolId),
    },
    periodDefinitionRepository: {
      ...periodDefinitions,
      listByAcademicYear: async academicYearId =>
        (await periodDefinitions.list()).filter(item => item.academicYearId === academicYearId),
    },
    gradeLevelRepository: {
      ...gradeLevels,
      listBySchool: async schoolId => (await gradeLevels.list()).filter(item => item.schoolId === schoolId),
    },
    classGroupRepository: {
      ...classGroups,
      listByAcademicYear: async academicYearId =>
        (await classGroups.list()).filter(item => item.academicYearId === academicYearId),
    },
    studentRepository: {
      ...students,
      listBySchool: async schoolId => (await students.list()).filter(item => item.schoolId === schoolId),
    },
    StudentClassEnrollmentRepository: {
      ...enrollments,
      findCurrentByStudent: async studentId =>
        (await enrollments.list()).find(item => item.studentId === studentId && item.isCurrent),
      listByStudent: async studentId => (await enrollments.list()).filter(item => item.studentId === studentId),
      listByClassGroup: async classGroupId =>
        (await enrollments.list()).filter(item => item.classGroupId === classGroupId),
    },
    guardianRepository: {
      ...guardians,
      listBySchool: async schoolId => (await guardians.list()).filter(item => item.schoolId === schoolId),
    },
    guardianStudentLinkRepository: {
      ...guardianLinks,
      findByGuardianAndStudent: async (guardianId, studentId) =>
        (await guardianLinks.list()).find(item => item.guardianId === guardianId && item.studentId === studentId),
      listByGuardian: async guardianId => (await guardianLinks.list()).filter(item => item.guardianId === guardianId),
      listByStudent: async studentId => (await guardianLinks.list()).filter(item => item.studentId === studentId),
    },
    staffMemberRepository: {
      ...staffMembers,
      listBySchool: async schoolId => (await staffMembers.list()).filter(item => item.schoolId === schoolId),
    },
    staffAssignmentRepository: {
      ...staffAssignments,
      listByStaff: async staffId => (await staffAssignments.list()).filter(item => item.staffId === staffId),
      listByClassGroup: async classGroupId =>
        (await staffAssignments.list()).filter(item => item.classGroupId === classGroupId),
      listByClassSubject: async classSubjectId =>
        (await staffAssignments.list()).filter(item => item.classSubjectId === classSubjectId),
      listBySession: async sessionId => (await staffAssignments.list()).filter(item => item.sessionId === sessionId),
      listByGroupedSession: async groupedSessionId =>
        (await staffAssignments.list()).filter(item => item.groupedSessionId === groupedSessionId),
    },
    subjectRepository: {
      ...subjects,
      listBySchool: async schoolId => (await subjects.list()).filter(item => item.schoolId === schoolId),
    },
    subjectMatterRepository: {
      ...subjectMatters,
      listBySubject: async subjectId => (await subjectMatters.list()).filter(item => item.subjectId === subjectId),
    },
    classSubjectRepository: {
      ...classSubjects,
      listByClassGroup: async classGroupId =>
        (await classSubjects.list()).filter(item => item.classGroupId === classGroupId),
      listBySubject: async subjectId => (await classSubjects.list()).filter(item => item.subjectId === subjectId),
    },
    classSubjectMatterRepository: {
      ...classSubjectMatters,
      save: entity => saveWithFailure('classSubjectMatterRepository', classSubjectMatters, entity),
      findByClassSubjectAndSubjectMatter: async (classSubjectId, subjectMatterId) =>
        (await classSubjectMatters.list()).find(item =>
          item.classSubjectId === classSubjectId && item.subjectMatterId === subjectMatterId,
        ),
      listByClassSubject: async classSubjectId =>
        (await classSubjectMatters.list()).filter(item => item.classSubjectId === classSubjectId),
    },
    classSubjectProgressRepository: {
      ...classSubjectProgress,
      findByClassSubjectMatterAndSession: async (matterId, sessionId) =>
        (await classSubjectProgress.list()).find(item =>
          item.classSubjectMatterId === matterId && item.sessionId === sessionId,
        ),
      listByClassSubjectMatter: async matterId =>
        (await classSubjectProgress.list()).filter(item => item.classSubjectMatterId === matterId),
      listBySession: async sessionId =>
        (await classSubjectProgress.list()).filter(item => item.sessionId === sessionId),
    },
    sessionRepository: {
      ...sessions,
      save: entity => saveWithFailure('sessionRepository', sessions, entity),
      listByClassGroup: async classGroupId => (await sessions.list()).filter(item => item.classGroupId === classGroupId),
      listBetween: async (startDate, endDate) =>
        (await sessions.list()).filter(item => item.startsAt >= startDate && item.endsAt <= endDate),
    },
    groupedSessionRepository: {
      ...groupedSessions,
      listByAcademicYear: async academicYearId =>
        (await groupedSessions.list()).filter(item => item.academicYearId === academicYearId),
      listBetween: async (startDate, endDate) =>
        (await groupedSessions.list()).filter(item => item.startsAt >= startDate && item.endsAt <= endDate),
    },
    assessmentRepository: {
      ...assessments,
      listByClassSubjectAndPeriod: async (classSubjectId, periodId) =>
        (await assessments.list()).filter(item =>
          item.classSubjectId === classSubjectId && item.periodId === periodId,
        ),
      listByPeriod: async periodId => (await assessments.list()).filter(item => item.periodId === periodId),
    },
    attendanceRepository: {
      ...attendance,
      findByStudentAndSession: async (studentId, sessionId) =>
        (await attendance.list()).find(item => item.studentId === studentId && item.sessionId === sessionId),
      listBySession: async sessionId => (await attendance.list()).filter(item => item.sessionId === sessionId),
      listByStudentBetween: async (studentId, startDate, endDate) =>
        (await attendance.list()).filter(item =>
          item.studentId === studentId && item.date >= startDate && item.date <= endDate,
        ),
    },
    gradeRepository: {
      ...grades,
      listByStudentAndPeriod: async (studentId, periodId) =>
        (await grades.list()).filter(item => item.studentId === studentId && item.periodId === periodId),
      listByClassSubjectAndPeriod: async (classSubjectId, periodId) =>
        (await grades.list()).filter(item => item.classSubjectId === classSubjectId && item.periodId === periodId),
      listByAssessment: async assessmentId => (await grades.list()).filter(item => item.assessmentId === assessmentId),
    },
    gradeScaleRepository: {
      ...gradeScales,
      findDefaultBySchool: async schoolId =>
        (await gradeScales.list()).find(item => item.schoolId === schoolId && item.isDefault),
      listBySchool: async schoolId => (await gradeScales.list()).filter(item => item.schoolId === schoolId),
    },
    reportCardDefinitionRepository: {
      ...definitions,
      findDefaultByGradeLevel: async (gradeLevelId, academicYearId) =>
        (await definitions.list()).find(item =>
          item.gradeLevelId === gradeLevelId && item.academicYearId === academicYearId && item.isDefault,
        ),
      listByGradeLevel: async (gradeLevelId, academicYearId) =>
        (await definitions.list()).filter(item =>
          item.gradeLevelId === gradeLevelId && item.academicYearId === academicYearId,
        ),
    },
    reportCardDefinitionSectionRepository: {
      ...sections,
      listByReportCardDefinition: async definitionId =>
        (await sections.list()).filter(item => item.reportCardDefinitionId === definitionId),
    },
    reportCardResultRepository: {
      ...results,
      save: entity => saveWithFailure('reportCardResultRepository', results, entity),
      findByStudentAndPeriod: async (studentId, periodId) =>
        (await results.list()).find(item => item.studentId === studentId && item.periodId === periodId),
      findByStudentAndExam: async (studentId, examId) =>
        (await results.list()).find(item => item.studentId === studentId && item.examId === examId),
      listByStudent: async studentId => (await results.list()).filter(item => item.studentId === studentId),
    },
    announcementRepository: {
      ...announcements,
      listBySchool: async schoolId => (await announcements.list()).filter(item => item.schoolId === schoolId),
    },
    announcementTargetRepository: {
      ...announcementTargets,
      listByAnnouncement: async announcementId =>
        (await announcementTargets.list()).filter(item => item.announcementId === announcementId),
      listByTarget: async (targetKind, targetId) =>
        (await announcementTargets.list()).filter(item =>
          item.targetKind === targetKind && item.targetId === targetId,
        ),
    },
    messageDeliveryRepository: {
      ...messageDeliveries,
      listByAnnouncement: async announcementId =>
        (await messageDeliveries.list()).filter(item => item.announcementId === announcementId),
      listByRecipient: async recipientId =>
        (await messageDeliveries.list()).filter(item => item.recipientId === recipientId),
    },
    feeRepository: {
      ...fees,
      listBySchool: async schoolId => (await fees.list()).filter(item => item.schoolId === schoolId),
      listByAcademicYear: async academicYearId =>
        (await fees.list()).filter(item => item.academicYearId === academicYearId),
    },
    studentFeeRepository: {
      ...studentFees,
      save: entity => saveWithFailure('studentFeeRepository', studentFees, entity),
      listByStudent: async studentId => (await studentFees.list()).filter(item => item.studentId === studentId),
    },
    paymentRepository: {
      ...payments,
      listByStudentFee: async studentFeeId =>
        (await payments.list()).filter(item => item.studentFeeId === studentFeeId),
    },
    scheduleRepository: {
      ...schedules,
      listByClassGroup: async classGroupId => (await schedules.list()).filter(item => item.classGroupId === classGroupId),
    },
    calendarEventRepository: {
      ...calendarEvents,
      listBySchool: async schoolId => (await calendarEvents.list()).filter(item => item.schoolId === schoolId),
      listByAcademicYear: async academicYearId =>
        (await calendarEvents.list()).filter(item => item.academicYearId === academicYearId),
    },
  }
  const application = new SchoolApplication({
    ...repositories,
    authorizationPolicy: new RepositoryAuthorizationPolicy({
      staffAssignmentRepository: repositories.staffAssignmentRepository,
      staffMemberRepository: repositories.staffMemberRepository,
      guardianRepository: repositories.guardianRepository,
      guardianStudentLinkRepository: repositories.guardianStudentLinkRepository,
      studentRepository: repositories.studentRepository,
    }),
  })
  const defaultActor = actor ?? createStaffActorMetadata({
    subjectId: 'admin-user',
    staffMemberId: 'admin',
    schoolId: 'school',
    roles: [StaffRole.Admin],
    requestId: 'integration-test',
    authenticatedAt: new Date('2026-09-01T00:00:00Z'),
  })
  if (defaultActor.kind === 'staff') {
    void repositories.staffMemberRepository.save(new StaffMember({
      id: defaultActor.staffMemberId,
      schoolId: defaultActor.schoolId,
      firstName: 'Fixture',
      lastName: 'Administrator',
      roles: defaultActor.roles,
    }))
  }
  return {
    app: application.forActor(defaultActor),
    repositories,
    forActor: boundActor => application.forActor(boundActor),
    failSaveOnAttempt,
  }
}
