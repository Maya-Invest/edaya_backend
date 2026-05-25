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
  Attachment,
  Resource,
  ResourceAssignment,
  StudentNote,
  StudentDisciplinaryAction,
  DisciplinaryAction,
  StudentIncidentInvolvement,
  Incident,
  Activity,
  StudentActivityEnrollment,
  ClassExam,
  Exam,
  ExamSubject,
} from '../../src/entities'
import type { BaseRepositoryInterface, SchoolRepositories } from '../../src/ports'
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

export function createTestApp(actor?: ActorMetadata) {
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

  // Empty stores for unused entities to satisfy interfaces
  const attachments = createStore<Attachment>(transactionParticipants)
  const resources = createStore<Resource>(transactionParticipants)
  const resourceAssignments = createStore<ResourceAssignment>(transactionParticipants)
  const studentNotes = createStore<StudentNote>(transactionParticipants)
  const studentDisciplinaryActions = createStore<StudentDisciplinaryAction>(transactionParticipants)
  const disciplinaryActions = createStore<DisciplinaryAction>(transactionParticipants)
  const studentIncidentInvolvements = createStore<StudentIncidentInvolvement>(transactionParticipants)
  const incidents = createStore<Incident>(transactionParticipants)
  const activities = createStore<Activity>(transactionParticipants)
  const studentActivityEnrollments = createStore<StudentActivityEnrollment>(transactionParticipants)
  const classExams = createStore<ClassExam>(transactionParticipants)
  const exams = createStore<Exam>(transactionParticipants)
  const examSubjects = createStore<ExamSubject>(transactionParticipants)

  const schoolRepositories: SchoolRepositories = {
    setup: {
      schools,
      academicYears: {
        ...academicYears,
        listBySchool: async schoolId => (await academicYears.list()).filter(item => item.schoolId === schoolId),
      },
      academicPeriods: {
        ...academicPeriods,
        listByAcademicYear: async academicYearId =>
          (await academicPeriods.list()).filter(item => item.academicYearId === academicYearId),
        listBySchool: async schoolId => (await academicPeriods.list()).filter(item => item.schoolId === schoolId),
      },
      periodDefinitions: {
        ...periodDefinitions,
        listByAcademicYear: async academicYearId =>
          (await periodDefinitions.list()).filter(item => item.academicYearId === academicYearId),
      },
      gradeLevels: {
        ...gradeLevels,
        listBySchool: async schoolId => (await gradeLevels.list()).filter(item => item.schoolId === schoolId),
      },
      staffMembers: {
        ...staffMembers,
        listBySchool: async schoolId => (await staffMembers.list()).filter(item => item.schoolId === schoolId),
      },
      staffAssignments: {
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
      attachments: {
        ...attachments,
        listByOwner: async (ownerKind, ownerId) =>
          (await attachments.list()).filter(item => item.ownerKind === ownerKind && item.ownerId === ownerId),
      },
      resources,
      resourceAssignments,
    },
    academics: {
      subjects: {
        ...subjects,
        listBySchool: async schoolId => (await subjects.list()).filter(item => item.schoolId === schoolId),
      },
      subjectMatters: {
        ...subjectMatters,
        listBySubject: async subjectId => (await subjectMatters.list()).filter(item => item.subjectId === subjectId),
      },
      classGroups: {
        ...classGroups,
        listByAcademicYear: async academicYearId =>
          (await classGroups.list()).filter(item => item.academicYearId === academicYearId),
      },
      classSubjects: {
        ...classSubjects,
        listByClassGroup: async classGroupId =>
          (await classSubjects.list()).filter(item => item.classGroupId === classGroupId),
        listBySubject: async subjectId => (await classSubjects.list()).filter(item => item.subjectId === subjectId),
      },
      classSubjectMatters: {
        ...classSubjectMatters,
        save: entity => saveWithFailure('classSubjectMatterRepository', classSubjectMatters, entity),
        findByClassSubjectAndSubjectMatter: async (classSubjectId, subjectMatterId) =>
          (await classSubjectMatters.list()).find(item =>
            item.classSubjectId === classSubjectId && item.subjectMatterId === subjectMatterId,
          ),
        listByClassSubject: async classSubjectId =>
          (await classSubjectMatters.list()).filter(item => item.classSubjectId === classSubjectId),
      },
      classSubjectProgress: {
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
      activities,
      studentActivityEnrollments,
    },
    scheduling: {
      schedules: {
        ...schedules,
        listByClassGroup: async classGroupId => (await schedules.list()).filter(item => item.classGroupId === classGroupId),
      },
      sessions: {
        ...sessions,
        save: entity => saveWithFailure('sessionRepository', sessions, entity),
        listByClassGroup: async classGroupId => (await sessions.list()).filter(item => item.classGroupId === classGroupId),
        listBetween: async (startDate, endDate) =>
          (await sessions.list()).filter(item => item.startsAt >= startDate && item.endsAt <= endDate),
      },
      groupedSessions: {
        ...groupedSessions,
        listByAcademicYear: async academicYearId =>
          (await groupedSessions.list()).filter(item => item.academicYearId === academicYearId),
        listBetween: async (startDate, endDate) =>
          (await groupedSessions.list()).filter(item => item.startsAt >= startDate && item.endsAt <= endDate),
      },
      attendance: {
        ...attendance,
        findByStudentAndSession: async (studentId, sessionId) =>
          (await attendance.list()).find(item => item.studentId === studentId && item.sessionId === sessionId),
        listBySession: async sessionId => (await attendance.list()).filter(item => item.sessionId === sessionId),
        listByStudentBetween: async (studentId, startDate, endDate) =>
          (await attendance.list()).filter(item =>
            item.studentId === studentId && item.date >= startDate && item.date <= endDate,
          ),
      },
      calendarEvents: {
        ...calendarEvents,
        listBySchool: async schoolId => (await calendarEvents.list()).filter(item => item.schoolId === schoolId),
        listByAcademicYear: async academicYearId =>
          (await calendarEvents.list()).filter(item => item.academicYearId === academicYearId),
      },
    },
    assessments: {
      assessments: {
        ...assessments,
        listByClassSubjectAndPeriod: async (classSubjectId, periodId) =>
          (await assessments.list()).filter(item =>
            item.classSubjectId === classSubjectId && item.periodId === periodId,
          ),
        listByPeriod: async periodId => (await assessments.list()).filter(item => item.periodId === periodId),
      },
      grades: {
        ...grades,
        listByStudentAndPeriod: async (studentId, periodId) =>
          (await grades.list()).filter(item => item.studentId === studentId && item.periodId === periodId),
        listByClassSubjectAndPeriod: async (classSubjectId, periodId) =>
          (await grades.list()).filter(item => item.classSubjectId === classSubjectId && item.periodId === periodId),
        listByAssessment: async assessmentId => (await grades.list()).filter(item => item.assessmentId === assessmentId),
      },
      gradeScales: {
        ...gradeScales,
        findDefaultBySchool: async schoolId =>
          (await gradeScales.list()).find(item => item.schoolId === schoolId && item.isDefault),
        listBySchool: async schoolId => (await gradeScales.list()).filter(item => item.schoolId === schoolId),
      },
      definitions: {
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
      sections: {
        ...sections,
        listByReportCardDefinition: async definitionId =>
          (await sections.list()).filter(item => item.reportCardDefinitionId === definitionId),
      },
      results: {
        ...results,
        save: entity => saveWithFailure('reportCardResultRepository', results, entity),
        findByStudentAndPeriod: async (studentId, periodId) =>
          (await results.list()).find(item => item.studentId === studentId && item.periodId === periodId),
        findByStudentAndExam: async (studentId, examId) =>
          (await results.list()).find(item => item.studentId === studentId && item.examId === examId),
        listByStudent: async studentId => (await results.list()).filter(item => item.studentId === studentId),
      },
      classExams: {
        ...classExams,
        findByExamAndClassGroupAndPeriod: async (examId, classGroupId, periodId) =>
          (await classExams.list()).find(item =>
            item.examId === examId && item.classGroupId === classGroupId && item.periodId === periodId,
          ),
        listByExam: async examId => (await classExams.list()).filter(item => item.examId === examId),
        listByClassGroupAndPeriod: async (classGroupId, periodId) =>
          (await classExams.list()).filter(item =>
            item.classGroupId === classGroupId && item.periodId === periodId,
          ),
      },
      exams,
      examSubjects,
    },
    students: {
      students: {
        ...students,
        listBySchool: async schoolId => (await students.list()).filter(item => item.schoolId === schoolId),
      },
      enrollments: {
        ...enrollments,
        findCurrentByStudent: async studentId =>
          (await enrollments.list()).find(item => item.studentId === studentId && item.isCurrent),
        listByStudent: async studentId => (await enrollments.list()).filter(item => item.studentId === studentId),
        listByClassGroup: async classGroupId =>
          (await enrollments.list()).filter(item => item.classGroupId === classGroupId),
      },
      guardians: {
        ...guardians,
        listBySchool: async schoolId => (await guardians.list()).filter(item => item.schoolId === schoolId),
      },
      guardianLinks: {
        ...guardianLinks,
        findByGuardianAndStudent: async (guardianId, studentId) =>
          (await guardianLinks.list()).find(item => item.guardianId === guardianId && item.studentId === studentId),
        listByGuardian: async guardianId => (await guardianLinks.list()).filter(item => item.guardianId === guardianId),
        listByStudent: async studentId => (await guardianLinks.list()).filter(item => item.studentId === studentId),
      },
      studentNotes,
      studentDisciplinaryActions,
      disciplinaryActions,
      studentIncidentInvolvements,
      incidents,
    },
    finance: {
      fees: {
        ...fees,
        listBySchool: async schoolId => (await fees.list()).filter(item => item.schoolId === schoolId),
        listByAcademicYear: async academicYearId =>
          (await fees.list()).filter(item => item.academicYearId === academicYearId),
      },
      studentFees: {
        ...studentFees,
        save: entity => saveWithFailure('studentFeeRepository', studentFees, entity),
        listByStudent: async studentId => (await studentFees.list()).filter(item => item.studentId === studentId),
      },
      payments: {
        ...payments,
        listByStudentFee: async studentFeeId =>
          (await payments.list()).filter(item => item.studentFeeId === studentFeeId),
      },
    },
    communications: {
      announcements: {
        ...announcements,
        listBySchool: async schoolId => (await announcements.list()).filter(item => item.schoolId === schoolId),
      },
      announcementTargets: {
        ...announcementTargets,
        listByAnnouncement: async announcementId =>
          (await announcementTargets.list()).filter(item => item.announcementId === announcementId),
        listByTarget: async (targetKind, targetId) =>
          (await announcementTargets.list()).filter(item =>
            item.targetKind === targetKind && item.targetId === targetId,
          ),
      },
      messageDeliveries: {
        ...messageDeliveries,
        listByAnnouncement: async announcementId =>
          (await messageDeliveries.list()).filter(item => item.announcementId === announcementId),
        listByRecipient: async recipientId =>
          (await messageDeliveries.list()).filter(item => item.recipientId === recipientId),
      },
    },
  }

  const testRepositories = {
    // Nested structure (implements SchoolRepositories)
    setup: schoolRepositories.setup,
    academics: schoolRepositories.academics,
    scheduling: schoolRepositories.scheduling,
    assessments: schoolRepositories.assessments,
    students: schoolRepositories.students,
    finance: schoolRepositories.finance,
    communications: schoolRepositories.communications,

    // Flat structure (for backward compatibility in existing tests)
    schoolRepository: schoolRepositories.setup.schools,
    academicYearRepository: schoolRepositories.setup.academicYears,
    academicPeriodRepository: schoolRepositories.setup.academicPeriods,
    periodDefinitionRepository: schoolRepositories.setup.periodDefinitions,
    gradeLevelRepository: schoolRepositories.setup.gradeLevels,
    classGroupRepository: schoolRepositories.academics.classGroups,
    studentRepository: schoolRepositories.students.students,
    StudentClassEnrollmentRepository: schoolRepositories.students.enrollments,
    guardianRepository: schoolRepositories.students.guardians,
    guardianStudentLinkRepository: schoolRepositories.students.guardianLinks,
    staffMemberRepository: schoolRepositories.setup.staffMembers,
    staffAssignmentRepository: schoolRepositories.setup.staffAssignments,
    subjectRepository: schoolRepositories.academics.subjects,
    subjectMatterRepository: schoolRepositories.academics.subjectMatters,
    classSubjectRepository: schoolRepositories.academics.classSubjects,
    classSubjectMatterRepository: schoolRepositories.academics.classSubjectMatters,
    classSubjectProgressRepository: schoolRepositories.academics.classSubjectProgress,
    sessionRepository: schoolRepositories.scheduling.sessions,
    groupedSessionRepository: schoolRepositories.scheduling.groupedSessions,
    assessmentRepository: schoolRepositories.assessments.assessments,
    attendanceRepository: schoolRepositories.scheduling.attendance,
    gradeRepository: schoolRepositories.assessments.grades,
    gradeScaleRepository: schoolRepositories.assessments.gradeScales,
    reportCardDefinitionRepository: schoolRepositories.assessments.definitions,
    reportCardDefinitionSectionRepository: schoolRepositories.assessments.sections,
    reportCardResultRepository: schoolRepositories.assessments.results,
    announcementRepository: schoolRepositories.communications.announcements,
    announcementTargetRepository: schoolRepositories.communications.announcementTargets,
    messageDeliveryRepository: schoolRepositories.communications.messageDeliveries,
    feeRepository: schoolRepositories.finance.fees,
    studentFeeRepository: schoolRepositories.finance.studentFees,
    paymentRepository: schoolRepositories.finance.payments,
    scheduleRepository: schoolRepositories.scheduling.schedules,
    calendarEventRepository: schoolRepositories.scheduling.calendarEvents,
  }

  const application = new SchoolApplication({
    atomicExecution: createAtomicExecution(transactionParticipants),
    repositories: schoolRepositories,
    authorizationPolicy: new RepositoryAuthorizationPolicy({
      staffAssignmentRepository: schoolRepositories.setup.staffAssignments,
      staffMemberRepository: schoolRepositories.setup.staffMembers,
      guardianRepository: schoolRepositories.students.guardians,
      guardianStudentLinkRepository: schoolRepositories.students.guardianLinks,
      studentRepository: schoolRepositories.students.students,
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
    void schoolRepositories.setup.staffMembers.save(new StaffMember({
      id: defaultActor.staffMemberId,
      schoolId: defaultActor.schoolId,
      firstName: 'Fixture',
      lastName: 'Administrator',
      roles: defaultActor.roles,
    }))
  }

  return {
    app: application.forActor(defaultActor),
    repositories: testRepositories,
    forActor: (boundActor: ActorMetadata) => application.forActor(boundActor),
    failSaveOnAttempt,
  }
}
