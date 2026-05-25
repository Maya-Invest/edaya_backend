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
  StaffMember,
  Student,
  StudentClassEnrollment,
  StudentFee,
  Subject,
  SubjectMatter,
} from '../../../src/entities'
import type { BaseRepositoryInterface } from '../../../src/ports'
import type { SchoolHeadlessAppArgs } from '../../../src/school-headless-app'
import { describe, expect, it } from 'bun:test'
import {
  AcademicPeriodType,
  AnnouncementAudience,
  AnnouncementStatus,
  AnnouncementTargetKind,
  AssessmentKind,
  AttendanceStatus,
  ClassSubjectMatterStatus,
  FeeStatus,
  MessageDeliveryChannel,
  MessageDeliveryRecipientKind,
  MessageDeliveryStatus,
  PaymentMethod,
  PaymentStatus,
  ReportCardDefinitionSectionKind,
  ReportCardResultStatus,
  SessionKind,
  StaffRole,
} from '../../../src/entities'
import { SchoolHeadlessApp } from '../../../src/school-headless-app'
import { runBaseRepositoryContract } from '../../support/base-repository-contract'

interface EntityWithId {
  readonly id: string
}

interface TransactionParticipant {
  begin: () => void
  commit: () => void
  rollback: () => void
}

function createStore<T extends EntityWithId>(participants: TransactionParticipant[] = []) {
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

type FailableRepository = 'classSubjectMatterRepository' | 'studentFeeRepository'

function createTestApp(): {
  app: SchoolHeadlessApp
  repositories: SchoolHeadlessAppArgs
  failNextSave: (repository: FailableRepository) => void
} {
  const transactionParticipants: TransactionParticipant[] = []
  let nextSaveFailure: FailableRepository | undefined
  const failNextSave = (repository: FailableRepository) => {
    nextSaveFailure = repository
  }
  const saveWithFailure = async <T extends EntityWithId>(
    repository: FailableRepository,
    store: BaseRepositoryInterface<T>,
    entity: T,
  ): Promise<void> => {
    if (nextSaveFailure === repository) {
      nextSaveFailure = undefined
      throw new Error(`Simulated ${repository} save failure`)
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

  const repositories: SchoolHeadlessAppArgs = {
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
  return { app: new SchoolHeadlessApp(repositories), repositories, failNextSave }
}

runBaseRepositoryContract(
  'in-memory repository base contract',
  () => createStore<{ id: string, value: string }>(),
  (id, value) => ({ id, value }),
)

describe('curriculum progress journey', () => {
  it('records cumulative progress once per session and updates class aggregates through the public facade', async () => {
    const { app, repositories } = createTestApp()
    const startsAt = new Date('2026-09-01T08:00:00Z')
    const endsAt = new Date('2026-09-01T09:00:00Z')

    await app.setup.registerSchool({ id: 'school', name: 'Maya School' })
    await app.setup.createAcademicYear({
      id: 'year',
      schoolId: 'school',
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-06-30T00:00:00Z'),
    })
    await app.setup.createGradeLevel({ id: 'level', schoolId: 'school', name: 'Grade 6', order: 6 })
    await app.setup.createClassGroup({
      id: 'class',
      schoolId: 'school',
      academicYearId: 'year',
      gradeLevelId: 'level',
      name: 'Grade 6 A',
    })
    await app.academics.createSubject({ id: 'math', schoolId: 'school', name: 'Mathematics' })
    const classSubject = await app.academics.offerSubjectToClass({
      id: 'class-math',
      classGroupId: 'class',
      subjectId: 'math',
    })
    const matter = await app.academics.createSubjectMatter({
      id: 'fractions',
      subjectId: 'math',
      name: 'Fractions',
      sequenceOrder: 1,
    })
    const classMatter = await app.academics.assignMatterToClassSubject({
      id: 'class-fractions',
      classSubjectId: classSubject.id,
      subjectMatterId: matter.id,
    })
    await app.scheduling.createSession({
      id: 'lesson-1',
      schoolId: 'school',
      classGroupId: 'class',
      classSubjectId: classSubject.id,
      title: 'Fractions introduction',
      kind: SessionKind.Course,
      startsAt,
      endsAt,
    })

    await app.academics.recordSessionProgress({
      id: 'progress-1',
      classSubjectMatterId: classMatter.id,
      sessionId: 'lesson-1',
      completedPercentage: 40,
      recordedAt: endsAt,
    })

    expect((await repositories.classSubjectMatterRepository.findById(classMatter.id))?.completedPercentage).toBe(40)
    expect((await repositories.classSubjectMatterRepository.findById(classMatter.id))?.status)
      .toBe(ClassSubjectMatterStatus.InProgress)
    expect((await repositories.classSubjectRepository.findById(classSubject.id))?.completedPercentage).toBe(40)
    expect(await app.academics.listMatterProgress(classMatter.id)).toHaveLength(1)
    await expect(app.academics.recordSessionProgress({
      id: 'progress-duplicate',
      classSubjectMatterId: classMatter.id,
      sessionId: 'lesson-1',
      completedPercentage: 50,
    })).rejects.toThrow('Progress has already been recorded')
    expect(await app.academics.listMatterProgress(classMatter.id)).toHaveLength(1)
  })

  it('rejects progress that decreases the current cumulative completion', async () => {
    const { app } = createTestApp()
    await app.setup.registerSchool({ id: 'school', name: 'Maya School' })
    await app.setup.createAcademicYear({
      id: 'year',
      schoolId: 'school',
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-06-30T00:00:00Z'),
    })
    await app.setup.createGradeLevel({ id: 'level', schoolId: 'school', name: 'Grade 6', order: 6 })
    await app.setup.createClassGroup({
      id: 'class',
      schoolId: 'school',
      academicYearId: 'year',
      gradeLevelId: 'level',
      name: 'Grade 6 A',
    })
    await app.academics.createSubject({ id: 'math', schoolId: 'school', name: 'Mathematics' })
    const classSubject = await app.academics.offerSubjectToClass({
      id: 'class-math',
      classGroupId: 'class',
      subjectId: 'math',
    })
    await app.academics.createSubjectMatter({ id: 'fractions', subjectId: 'math', name: 'Fractions', sequenceOrder: 1 })
    const classMatter = await app.academics.assignMatterToClassSubject({
      id: 'class-fractions',
      classSubjectId: classSubject.id,
      subjectMatterId: 'fractions',
    })
    await app.scheduling.createSession({
      id: 'lesson-1',
      schoolId: 'school',
      classGroupId: 'class',
      classSubjectId: classSubject.id,
      title: 'Fractions I',
      kind: SessionKind.Course,
      startsAt: new Date('2026-09-01T08:00:00Z'),
      endsAt: new Date('2026-09-01T09:00:00Z'),
    })
    await app.scheduling.createSession({
      id: 'lesson-2',
      schoolId: 'school',
      classGroupId: 'class',
      classSubjectId: classSubject.id,
      title: 'Fractions II',
      kind: SessionKind.Course,
      startsAt: new Date('2026-09-02T08:00:00Z'),
      endsAt: new Date('2026-09-02T09:00:00Z'),
    })
    await app.academics.recordSessionProgress({
      id: 'progress-1',
      classSubjectMatterId: classMatter.id,
      sessionId: 'lesson-1',
      completedPercentage: 60,
    })

    await expect(app.academics.recordSessionProgress({
      id: 'progress-2',
      classSubjectMatterId: classMatter.id,
      sessionId: 'lesson-2',
      completedPercentage: 30,
    })).rejects.toThrow('completedPercentage must not decrease')
  })
})

describe('assessment reporting journey', () => {
  it('publishes a report card from scheduled instruction, attendance, and a recorded grade', async () => {
    const { app } = createTestApp()
    await app.setup.registerSchool({ id: 'school', name: 'Maya School' })
    await app.setup.createAcademicYear({
      id: 'year',
      schoolId: 'school',
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-06-30T23:59:59Z'),
    })
    await app.setup.createAcademicPeriod({
      id: 'term',
      schoolId: 'school',
      academicYearId: 'year',
      name: 'Trimester 1',
      type: AcademicPeriodType.Trimester,
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2026-12-31T23:59:59Z'),
    })
    await app.setup.createGradeLevel({ id: 'level', schoolId: 'school', name: 'Grade 6', order: 6 })
    await app.setup.createClassGroup({
      id: 'class',
      schoolId: 'school',
      academicYearId: 'year',
      gradeLevelId: 'level',
      name: 'Grade 6 A',
    })

    const periodDefinition = await app.scheduling.definePeriod({
      id: 'period-1',
      schoolId: 'school',
      academicYearId: 'year',
      label: 'Period 1',
      order: 1,
      startTime: '08:00',
      endTime: '09:00',
    })
    const groupedSession = await app.scheduling.createGroupedSession({
      id: 'assembly',
      schoolId: 'school',
      academicYearId: 'year',
      academicPeriodId: 'term',
      title: 'Term opening',
      kind: SessionKind.Course,
      startsAt: new Date('2026-09-01T07:30:00Z'),
      endsAt: new Date('2026-09-01T08:00:00Z'),
    })
    expect(periodDefinition.durationMinutes).toBe(60)
    expect(groupedSession.academicPeriodId).toBe('term')

    await app.students.registerStudent({
      id: 'student',
      schoolId: 'school',
      firstName: 'Amira',
      lastName: 'Diallo',
    })
    await app.students.enrollStudent({ id: 'enrollment', studentId: 'student', classGroupId: 'class' })
    await app.academics.createSubject({ id: 'math', schoolId: 'school', name: 'Mathematics' })
    const classSubject = await app.academics.offerSubjectToClass({
      id: 'class-math',
      classGroupId: 'class',
      subjectId: 'math',
    })
    await app.scheduling.createSession({
      id: 'lesson',
      schoolId: 'school',
      classGroupId: 'class',
      classSubjectId: classSubject.id,
      title: 'Fractions',
      kind: SessionKind.Course,
      startsAt: new Date('2026-09-01T08:00:00Z'),
      endsAt: new Date('2026-09-01T09:00:00Z'),
    })
    await app.attendance.recordAttendance({
      id: 'attendance',
      studentId: 'student',
      sessionId: 'lesson',
      status: AttendanceStatus.Present,
    })

    await app.assessments.createGradeScale({
      id: 'standard-scale',
      schoolId: 'school',
      name: 'Standard out of 20',
      minScore: 0,
      maxScore: 20,
      ranges: [
        { letter: 'Needs Support', minScore: 0, maxScore: 9.99, isPassing: false },
        { letter: 'Pass', minScore: 10, maxScore: 20, isPassing: true },
      ],
      isDefault: true,
    })
    await app.assessments.createReportCardDefinition({
      id: 'definition',
      schoolId: 'school',
      academicYearId: 'year',
      gradeLevelId: 'level',
      name: 'Grade 6 Standard',
      isDefault: true,
    })
    await app.assessments.createReportCardDefinitionSection({
      id: 'math-section',
      reportCardDefinitionId: 'definition',
      kind: ReportCardDefinitionSectionKind.Subject,
      name: 'Mathematics',
      weight: 1,
      subjectId: 'math',
    })
    await app.assessments.createAssessment({
      id: 'quiz',
      classGroupId: 'class',
      classSubjectId: classSubject.id,
      periodId: 'term',
      title: 'Fractions quiz',
      kind: AssessmentKind.Quiz,
      maxScore: 20,
      sessionId: 'lesson',
    })
    await app.assessments.recordGrade({
      id: 'grade',
      studentId: 'student',
      assessmentId: 'quiz',
      score: 16,
    })

    const reportCard = await app.assessments.publishReportCardResult({
      id: 'report-card',
      studentId: 'student',
      periodId: 'term',
    })

    expect(reportCard.status).toBe(ReportCardResultStatus.Published)
    expect(reportCard.gradeCount).toBe(1)
    expect(reportCard.overallAverage).toBe(16)
    expect(reportCard.attendanceSummary.presentCount).toBe(1)
    expect(reportCard.sectionResults).toHaveLength(1)
    const directory = await app.queries.listStudents({ schoolId: 'school' })
    expect(directory.rows[0]?.latestReportCardResult?.status).toBe(ReportCardResultStatus.Published)
  })
})

describe('operations query journey', () => {
  it('projects finance and communications state through the screen query facade', async () => {
    const { app, repositories } = createTestApp()
    await app.setup.registerSchool({ id: 'school', name: 'Maya School' })
    await app.setup.createAcademicYear({
      id: 'year',
      schoolId: 'school',
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-06-30T23:59:59Z'),
    })
    await app.setup.createGradeLevel({ id: 'level', schoolId: 'school', name: 'Grade 6', order: 6 })
    await app.setup.createClassGroup({
      id: 'class',
      schoolId: 'school',
      academicYearId: 'year',
      gradeLevelId: 'level',
      name: 'Grade 6 A',
    })
    await app.students.registerStudent({
      id: 'student',
      schoolId: 'school',
      firstName: 'Amira',
      lastName: 'Diallo',
    })
    await app.students.enrollStudent({ id: 'enrollment', studentId: 'student', classGroupId: 'class' })
    await app.students.registerGuardian({
      id: 'guardian',
      schoolId: 'school',
      firstName: 'Nadia',
      lastName: 'Diallo',
      email: 'nadia@example.test',
    })
    await app.students.linkGuardianToStudent({
      id: 'guardian-link',
      guardianId: 'guardian',
      studentId: 'student',
      isPrimary: true,
    })

    await app.finance.createFee({
      id: 'tuition',
      schoolId: 'school',
      academicYearId: 'year',
      name: 'Tuition',
      defaultAmount: 90000,
      currency: 'XAF',
    })
    const studentFee = await app.finance.assignFeeToStudent({
      id: 'student-tuition',
      studentId: 'student',
      feeId: 'tuition',
      dueDate: new Date('2026-09-15T00:00:00Z'),
      referenceDate: new Date('2026-09-01T00:00:00Z'),
    })
    await app.finance.recordPayment({
      id: 'tuition-payment',
      studentFeeId: studentFee.id,
      amount: 30000,
      paymentDate: new Date('2026-09-20T00:00:00Z'),
      method: PaymentMethod.MobileMoney,
      referenceDate: new Date('2026-09-20T00:00:00Z'),
    })
    expect((await repositories.studentFeeRepository.findById(studentFee.id))?.status).toBe(FeeStatus.Overdue)
    await app.finance.recordPayment({
      id: 'tuition-final-payment',
      studentFeeId: studentFee.id,
      amount: 60000,
      paymentDate: new Date('2026-09-21T00:00:00Z'),
      method: PaymentMethod.Cash,
      referenceDate: new Date('2026-09-21T00:00:00Z'),
    })
    expect((await repositories.studentFeeRepository.findById(studentFee.id))?.status).toBe(FeeStatus.Paid)
    expect((await app.finance.buildFeeSummary('student')).balanceDue.amount).toBe(0)
    const reversed = await app.finance.reversePayment({
      paymentId: 'tuition-final-payment',
      reversedAt: new Date('2026-09-22T00:00:00Z'),
      referenceDate: new Date('2026-09-22T00:00:00Z'),
    })
    expect(reversed.status).toBe(PaymentStatus.Reversed)
    expect((await repositories.studentFeeRepository.findById(studentFee.id))?.status).toBe(FeeStatus.Overdue)
    const feeSummary = await app.finance.buildFeeSummary('student')
    expect(feeSummary.totalPaid.amount).toBe(30000)
    expect(feeSummary.balanceDue.amount).toBe(60000)
    expect(feeSummary.totalOverdue.amount).toBe(60000)

    await app.communications.createAnnouncement({
      id: 'fee-reminder',
      schoolId: 'school',
      title: 'Fee reminder',
      content: 'Please review the remaining tuition balance.',
      audience: AnnouncementAudience.ClassGroup,
      classGroupId: 'class',
      createdAt: new Date('2026-09-20T09:00:00Z'),
    })
    await expect(app.communications.recordDelivery({
      id: 'early-delivery',
      announcementId: 'fee-reminder',
      recipientKind: MessageDeliveryRecipientKind.Guardian,
      recipientId: 'guardian',
      channel: MessageDeliveryChannel.Email,
      status: MessageDeliveryStatus.Sent,
      sentAt: new Date('2026-09-20T09:30:00Z'),
    })).rejects.toThrow('must be published before recording delivery')
    await app.communications.addTarget({
      id: 'guardian-target',
      announcementId: 'fee-reminder',
      targetKind: AnnouncementTargetKind.Guardian,
      targetId: 'guardian',
    })
    const announcement = await app.communications.publishAnnouncement({
      announcementId: 'fee-reminder',
      publishedAt: new Date('2026-09-20T10:00:00Z'),
    })
    const delivery = await app.communications.recordDelivery({
      id: 'guardian-delivery',
      announcementId: 'fee-reminder',
      recipientKind: MessageDeliveryRecipientKind.Guardian,
      recipientId: 'guardian',
      channel: MessageDeliveryChannel.Email,
      status: MessageDeliveryStatus.Sent,
      sentAt: new Date('2026-09-20T10:01:00Z'),
    })
    const readDelivery = await app.communications.recordDelivery({
      id: 'guardian-read-delivery',
      announcementId: 'fee-reminder',
      recipientKind: MessageDeliveryRecipientKind.Guardian,
      recipientId: 'guardian',
      channel: MessageDeliveryChannel.App,
      status: MessageDeliveryStatus.Read,
      sentAt: new Date('2026-09-20T10:02:00Z'),
      readAt: new Date('2026-09-20T10:03:00Z'),
    })
    const failedDelivery = await app.communications.recordDelivery({
      id: 'guardian-failed-delivery',
      announcementId: 'fee-reminder',
      recipientKind: MessageDeliveryRecipientKind.Guardian,
      recipientId: 'guardian',
      channel: MessageDeliveryChannel.Sms,
      status: MessageDeliveryStatus.Failed,
      failureReason: 'provider rejected destination',
    })
    expect(announcement.status).toBe(AnnouncementStatus.Published)
    expect(delivery.status).toBe(MessageDeliveryStatus.Sent)
    expect(readDelivery.status).toBe(MessageDeliveryStatus.Read)
    expect(failedDelivery.status).toBe(MessageDeliveryStatus.Failed)

    const studentDirectory = await app.queries.listStudents({ schoolId: 'school' })
    const schoolOverview = await app.queries.getSchoolOverview({ schoolId: 'school' })
    const classGroups = await app.queries.listClassGroups({ schoolId: 'school' })
    const guardianStudents = await app.queries.listStudentsForGuardian('guardian')

    expect(studentDirectory.rows[0]?.balanceDue).toBe(60000)
    expect(studentDirectory.rows[0]?.guardianCount).toBe(1)
    expect(schoolOverview.overdueFeeCount).toBe(1)
    expect(schoolOverview.recentAnnouncements[0]?.id).toBe('fee-reminder')
    expect(classGroups.rows[0]?.studentCount).toBe(1)
    expect(guardianStudents[0]?.id).toBe('student')
  })
})

describe('assignment and query journey', () => {
  it('resolves staff assignments into timetable and attendance screen queries', async () => {
    const { app, repositories } = createTestApp()
    await app.setup.registerSchool({ id: 'school', name: 'Maya School' })
    await app.setup.createAcademicYear({
      id: 'year',
      schoolId: 'school',
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-06-30T23:59:59Z'),
    })
    await app.setup.createAcademicPeriod({
      id: 'term',
      schoolId: 'school',
      academicYearId: 'year',
      name: 'Trimester 1',
      type: AcademicPeriodType.Trimester,
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2026-12-31T23:59:59Z'),
    })
    await app.setup.createGradeLevel({ id: 'level', schoolId: 'school', name: 'Grade 6', order: 6 })
    await app.setup.createClassGroup({
      id: 'class',
      schoolId: 'school',
      academicYearId: 'year',
      gradeLevelId: 'level',
      name: 'Grade 6 A',
    })
    await app.setup.registerStaffMember({
      id: 'teacher',
      schoolId: 'school',
      firstName: 'Binta',
      lastName: 'Sow',
      roles: [StaffRole.Teacher],
    })
    await app.students.registerStudent({
      id: 'student',
      schoolId: 'school',
      firstName: 'Amira',
      lastName: 'Diallo',
    })
    await app.students.enrollStudent({ id: 'enrollment', studentId: 'student', classGroupId: 'class' })
    await app.academics.createSubject({ id: 'math', schoolId: 'school', name: 'Mathematics' })
    const classSubject = await app.academics.offerSubjectToClass({
      id: 'class-math',
      classGroupId: 'class',
      subjectId: 'math',
    })
    const groupedSession = await app.scheduling.createGroupedSession({
      id: 'assembly',
      schoolId: 'school',
      academicYearId: 'year',
      academicPeriodId: 'term',
      title: 'Assembly',
      kind: SessionKind.Event,
      startsAt: new Date('2026-09-01T07:30:00Z'),
      endsAt: new Date('2026-09-01T08:00:00Z'),
    })
    const session = await app.scheduling.createSession({
      id: 'lesson',
      schoolId: 'school',
      classGroupId: 'class',
      classSubjectId: classSubject.id,
      title: 'Fractions',
      kind: SessionKind.Course,
      startsAt: new Date('2026-09-01T08:00:00Z'),
      endsAt: new Date('2026-09-01T09:00:00Z'),
    })
    await app.setup.assignStaffToClass({
      id: 'class-teacher',
      staffId: 'teacher',
      classGroupId: 'class',
      role: StaffRole.Teacher,
    })
    await app.setup.assignStaffToClassSubject({
      id: 'math-teacher',
      staffId: 'teacher',
      classSubjectId: classSubject.id,
      role: StaffRole.Teacher,
    })
    await app.setup.assignStaffToSession({
      id: 'lesson-teacher',
      staffId: 'teacher',
      sessionId: session.id,
      role: StaffRole.Teacher,
    })
    await app.setup.assignStaffToGroupedSession({
      id: 'assembly-teacher',
      staffId: 'teacher',
      groupedSessionId: groupedSession.id,
      role: StaffRole.Teacher,
    })
    await app.attendance.recordAttendance({
      id: 'attendance',
      studentId: 'student',
      sessionId: session.id,
      status: AttendanceStatus.Late,
    })

    const workspace = await app.queries.getWorkspaceContext({ schoolId: 'school', classGroupId: 'class' })
    const classGroups = await app.queries.listClassGroups({ schoolId: 'school' })
    const timetable = await app.queries.listClassGroupTimetable('class')
    const attendanceReview = await app.queries.getAttendanceSessionReview({
      schoolId: 'school',
      date: new Date('2026-09-01T00:00:00Z'),
      sessionId: session.id,
    })

    expect(workspace.teacherCourseLoads[0]?.assignedCourseCount).toBe(1)
    expect(classGroups.rows[0]?.teacherNames).toEqual(['Binta Sow'])
    expect(timetable[0]?.courseName).toBe('Mathematics')
    expect(timetable[0]?.teacherName).toBe('Binta Sow')
    expect(attendanceReview.summary).toEqual({ present: 0, absent: 0, late: 1, total: 1 })
    expect(await repositories.staffAssignmentRepository.listByClassGroup('class')).toHaveLength(1)
    expect(await repositories.staffAssignmentRepository.listBySession(session.id)).toHaveLength(1)
    expect(await repositories.staffAssignmentRepository.listByGroupedSession(groupedSession.id)).toHaveLength(1)
  })
})

describe('atomic workflow safeguards', () => {
  it('rolls back curriculum progress when a later aggregate write fails', async () => {
    const { app, repositories, failNextSave } = createTestApp()
    await app.setup.registerSchool({ id: 'school', name: 'Maya School' })
    await app.setup.createAcademicYear({
      id: 'year',
      schoolId: 'school',
      name: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2027-06-30T23:59:59Z'),
    })
    await app.setup.createGradeLevel({ id: 'level', schoolId: 'school', name: 'Grade 6', order: 6 })
    await app.setup.createClassGroup({
      id: 'class',
      schoolId: 'school',
      academicYearId: 'year',
      gradeLevelId: 'level',
      name: 'Grade 6 A',
    })
    await app.academics.createSubject({ id: 'math', schoolId: 'school', name: 'Mathematics' })
    const classSubject = await app.academics.offerSubjectToClass({
      id: 'class-math',
      classGroupId: 'class',
      subjectId: 'math',
    })
    await app.academics.createSubjectMatter({ id: 'fractions', subjectId: 'math', name: 'Fractions', sequenceOrder: 1 })
    const classMatter = await app.academics.assignMatterToClassSubject({
      id: 'class-fractions',
      classSubjectId: classSubject.id,
      subjectMatterId: 'fractions',
    })
    await app.scheduling.createSession({
      id: 'lesson',
      schoolId: 'school',
      classGroupId: 'class',
      classSubjectId: classSubject.id,
      title: 'Fractions',
      kind: SessionKind.Course,
      startsAt: new Date('2026-09-01T08:00:00Z'),
      endsAt: new Date('2026-09-01T09:00:00Z'),
    })

    failNextSave('classSubjectMatterRepository')
    await expect(app.academics.recordSessionProgress({
      id: 'progress',
      classSubjectMatterId: classMatter.id,
      sessionId: 'lesson',
      completedPercentage: 50,
    })).rejects.toThrow('Simulated classSubjectMatterRepository save failure')

    expect(await app.academics.listMatterProgress(classMatter.id)).toHaveLength(0)
    expect((await repositories.classSubjectMatterRepository.findById(classMatter.id))?.completedPercentage).toBe(0)
    expect((await repositories.classSubjectRepository.findById(classSubject.id))?.completedPercentage).toBe(0)
  })

  it('rolls back payment recording and reversal when balance updates fail', async () => {
    const { app, repositories, failNextSave } = createTestApp()
    await app.setup.registerSchool({ id: 'school', name: 'Maya School' })
    await app.students.registerStudent({
      id: 'student',
      schoolId: 'school',
      firstName: 'Amira',
      lastName: 'Diallo',
    })
    await app.finance.createFee({
      id: 'tuition',
      schoolId: 'school',
      academicYearId: 'year',
      name: 'Tuition',
      defaultAmount: 90000,
      currency: 'XAF',
    })
    const studentFee = await app.finance.assignFeeToStudent({
      id: 'student-tuition',
      studentId: 'student',
      feeId: 'tuition',
      referenceDate: new Date('2026-09-01T00:00:00Z'),
    })

    failNextSave('studentFeeRepository')
    await expect(app.finance.recordPayment({
      id: 'payment',
      studentFeeId: studentFee.id,
      amount: 30000,
      paymentDate: new Date('2026-09-01T00:00:00Z'),
      method: PaymentMethod.Cash,
      referenceDate: new Date('2026-09-01T00:00:00Z'),
    })).rejects.toThrow('Simulated studentFeeRepository save failure')
    expect(await repositories.paymentRepository.findById('payment')).toBeUndefined()
    expect((await repositories.studentFeeRepository.findById(studentFee.id))?.paidAmount.amount).toBe(0)

    await app.finance.recordPayment({
      id: 'payment',
      studentFeeId: studentFee.id,
      amount: 30000,
      paymentDate: new Date('2026-09-01T00:00:00Z'),
      method: PaymentMethod.Cash,
      referenceDate: new Date('2026-09-01T00:00:00Z'),
    })
    failNextSave('studentFeeRepository')
    await expect(app.finance.reversePayment({
      paymentId: 'payment',
      reversedAt: new Date('2026-09-02T00:00:00Z'),
      referenceDate: new Date('2026-09-02T00:00:00Z'),
    })).rejects.toThrow('Simulated studentFeeRepository save failure')
    expect((await repositories.paymentRepository.findById('payment'))?.status).toBe(PaymentStatus.Recorded)
    expect((await repositories.studentFeeRepository.findById(studentFee.id))?.paidAmount.amount).toBe(30000)
  })
})
