import type {
  AcademicPeriod,
  AcademicYear,
  Announcement,
  AnnouncementTarget,
  Assessment,
  AssessmentResult,
  Attachment,
  AttendanceRecord,
  CalendarEvent,
  ClassGroup,
  ClassSubject,
  ClassSubjectMatter,
  ClassSubjectProgress,
  DisciplinaryAction,
  Fee,
  GradeLevel,
  GradeScale,
  Guardian,
  GuardianStudentLink,
  Incident,
  MessageDelivery,
  Payment,
  PeriodDefinition,
  ReportCardDefinition,
  ReportCardDefinitionSection,
  ReportCardResult,
  Resource,
  ResourceAssignment,
  Schedule,
  School,
  Session,
  StaffAssignment,
  Student,
  StudentClassEnrollment,
  StudentDisciplinaryAction,
  StudentFee,
  StudentHealthProfile,
  StudentIncidentInvolvement,
  StudentNote,
  Subject,
  SubjectMatter,
} from '../../src/entities'
import type { BaseRepositoryInterface, Filter, SchoolRepositories } from '../../src/ports'
import type { ActorMetadata } from '../../src/services/authorization'
import { StaffMember, StaffRole, StudentClassEnrollmentStatus } from '../../src/entities'
import {
  createStaffActorMetadata,
  RepositoryAuthorizationPolicy,
} from '../../src/services/authorization'
import { SchoolApplication } from '../../src/services/school-headless-app'
import { matchesFilter } from '../utils/filter-matcher'

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
    list: async (options?: import('../../src/ports').QueryOptions<T>) => {
      let result = [...entries.values()]
      if (options) {
        // Extract filter by omitting $ prefixed keys
        const filter: any = {}
        for (const key of Object.keys(options)) {
          if (!key.startsWith('$')) {
            filter[key] = (options as any)[key]
          }
        }
        if (Object.keys(filter).length > 0) {
          result = result.filter(entity => matchesFilter(entity, filter))
        }

        if (options.$orderBy) {
          result.sort((a, b) => {
            for (const { field, direction } of options.$orderBy!) {
              const valA = a[field]
              const valB = b[field]
              if (valA < valB)
                return direction === 'asc' ? -1 : 1
              if (valA > valB)
                return direction === 'asc' ? 1 : -1
            }
            return 0
          })
        }
        if (options.$offset !== undefined || options.$limit !== undefined) {
          const offset = options.$offset ?? 0
          result = result.slice(offset, options.$limit !== undefined ? offset + options.$limit : undefined)
        }
      }
      return result
    },
    save: async (entity: T) => {
      entries.set(entity.id, entity)
    },
    delete: async (id: string) => {
      entries.delete(id)
    },
    count: async (filter?: Filter<T>) => {
      const all = [...entries.values()]
      if (!filter)
        return all.length
      return all.filter(entity => matchesFilter(entity, filter)).length
    },
    batchSave: async (entitiesToSave: T[]) => {
      for (const entity of entitiesToSave) {
        entries.set(entity.id, entity)
      }
      return entitiesToSave.map(e => e.id)
    },
    batchDelete: async (ids: string[]) => {
      for (const id of ids) {
        entries.delete(id)
      }
    },
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
    | 'messageDeliveryRepository'
    | 'reportCardResultRepository'
    | 'sessionRepository'
    | 'studentClassEnrollmentRepository'
    | 'studentFeeRepository'

export function createInMemoryTestApp(actor?: ActorMetadata) {
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
  const assessments = createStore<Assessment>(transactionParticipants)
  const attendance = createStore<AttendanceRecord>(transactionParticipants)
  const assessmentResults = createStore<AssessmentResult>(transactionParticipants)
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
  const studentHealthProfiles = createStore<StudentHealthProfile>(transactionParticipants)
  const studentDisciplinaryActions = createStore<StudentDisciplinaryAction>(transactionParticipants)
  const disciplinaryActions = createStore<DisciplinaryAction>(transactionParticipants)
  const studentIncidentInvolvements = createStore<StudentIncidentInvolvement>(transactionParticipants)
  const incidents = createStore<Incident>(transactionParticipants)

  const schoolRepositories: SchoolRepositories = {
    // setup
    schools: {
      ...schools,
      getOverdueFeeCount: async (schoolId: string) => {
        const allStudents = await students.list({ schoolId })
        const studentIds = new Set(allStudents.map(s => s.id))
        const allFees = await studentFees.list()
        return allFees.filter(f => studentIds.has(f.studentId) && f.status === 'overdue').length
      },
      getPublishedReportCardCount: async (schoolId: string) => {
        const allStudents = await students.list({ schoolId })
        const studentIds = new Set(allStudents.map(s => s.id))
        const rcs = await results.list()
        return rcs.filter(rc => studentIds.has(rc.studentId) && rc.status === 'published').length
      },
    },
    academicYears,
    academicPeriods,
    periodDefinitions,
    gradeLevels,
    staffMembers,
    staffAssignments,
    attachments,
    resources,
    resourceAssignments,

    // finances
    fees,
    studentFees: {
      ...studentFees,
      save: entity => saveWithFailure('studentFeeRepository', studentFees, entity),
    },
    payments,

    // scheduling
    schedules,
    sessions: {
      ...sessions,
      save: entity => saveWithFailure('sessionRepository', sessions, entity),
    },
    attendance: {
      ...attendance,
      findByStudentAndSession: async (studentId, sessionId) =>
        (await attendance.list({ studentId, sessionId }))[0],
    },
    calendarEvents,

    // academics
    subjects,
    subjectMatters,
    classGroups,
    classSubjects: {
      ...classSubjects,
      findByClassAndSubject: async (classGroupId, subjectId) =>
        (await classSubjects.list({ classGroupId, subjectId }))[0],
    },
    classSubjectMatters: {
      ...classSubjectMatters,
      save: entity => saveWithFailure('classSubjectMatterRepository', classSubjectMatters, entity),
      findByClassSubjectAndSubjectMatter: async (classSubjectId, subjectMatterId) =>
        (await classSubjectMatters.list({ classSubjectId, subjectMatterId }))[0],
    },
    classSubjectProgress: {
      ...classSubjectProgress,
      findByClassSubjectMatterAndSession: async (matterId, sessionId) =>
        (await classSubjectProgress.list({ classSubjectMatterId: matterId, sessionId }))[0],
    },

    // assessments
    assessments,
    assessmentResults,
    gradeScales: {
      ...gradeScales,
      findDefaultBySchool: async schoolId =>
        (await gradeScales.list({ schoolId, isDefault: true }))[0],
    },
    definitions: {
      ...definitions,
      findDefaultByGradeLevel: async (gradeLevelId, academicYearId) =>
        (await definitions.list({ gradeLevelId, academicYearId, isDefault: true }))[0],
    },
    sections,
    results: {
      ...results,
      save: entity => saveWithFailure('reportCardResultRepository', results, entity),
      findByStudentAndPeriod: async (studentId, periodId) =>
        (await results.list({ studentId, periodId }))[0],
    },

    // students
    students,
    enrollments: {
      ...enrollments,
      save: entity => saveWithFailure('studentClassEnrollmentRepository', enrollments, entity),
      findActiveByStudent: async studentId =>
        (await enrollments.list({ studentId, status: StudentClassEnrollmentStatus.Active }))[0],
    },
    guardians,
    guardianLinks: {
      ...guardianLinks,
      findByGuardianAndStudent: async (guardianId, studentId) =>
        (await guardianLinks.list({ guardianId, studentId }))[0],
    },
    studentNotes,
    studentHealthProfiles,
    studentDisciplinaryActions,
    disciplinaryActions,
    studentIncidentInvolvements,
    incidents,

    // communications
    announcements,
    announcementTargets,
    messageDeliveries: {
      ...messageDeliveries,
      save: entity => saveWithFailure('messageDeliveryRepository', messageDeliveries, entity),
    },

  }

  const testRepositories = {
    // Nested structure (implements SchoolRepositories)
    // setup: schoolRepositories.setup,
    // finance: schoolRepositories.finance,
    // scheduling: schoolRepositories.scheduling,
    // communications: schoolRepositories.communications,
    // academics: schoolRepositories.academics,
    // assessments: schoolRepositories.assessments,
    // students: schoolRepositories.students,

    // Flat structure (for backward compatibility in existing tests)
    schoolRepository: schoolRepositories.schools,
    academicYearRepository: schoolRepositories.academicYears,
    academicPeriodRepository: schoolRepositories.academicPeriods,
    periodDefinitionRepository: schoolRepositories.periodDefinitions,
    gradeLevelRepository: schoolRepositories.gradeLevels,
    classGroupRepository: schoolRepositories.classGroups,
    studentRepository: schoolRepositories.students,
    StudentClassEnrollmentRepository: schoolRepositories.enrollments,
    guardianRepository: schoolRepositories.guardians,
    guardianStudentLinkRepository: schoolRepositories.guardianLinks,
    staffMemberRepository: schoolRepositories.staffMembers,
    staffAssignmentRepository: schoolRepositories.staffAssignments,
    subjectRepository: schoolRepositories.subjects,
    subjectMatterRepository: schoolRepositories.subjectMatters,
    classSubjectRepository: schoolRepositories.classSubjects,
    classSubjectMatterRepository: schoolRepositories.classSubjectMatters,
    classSubjectProgressRepository: schoolRepositories.classSubjectProgress,
    sessionRepository: schoolRepositories.sessions,
    assessmentRepository: schoolRepositories.assessments,
    attendanceRepository: schoolRepositories.attendance,
    assessmentResultRepository: schoolRepositories.assessmentResults,
    gradeScaleRepository: schoolRepositories.gradeScales,
    reportCardDefinitionRepository: schoolRepositories.definitions,
    reportCardDefinitionSectionRepository: schoolRepositories.sections,
    reportCardResultRepository: schoolRepositories.results,
    announcementRepository: schoolRepositories.announcements,
    announcementTargetRepository: schoolRepositories.announcementTargets,
    messageDeliveryRepository: schoolRepositories.messageDeliveries,
    feeRepository: schoolRepositories.fees,
    studentFeeRepository: schoolRepositories.studentFees,
    paymentRepository: schoolRepositories.payments,
    scheduleRepository: schoolRepositories.schedules,
    calendarEventRepository: schoolRepositories.calendarEvents,
    attachmentRepository: schoolRepositories.attachments,
    resourceRepository: schoolRepositories.resources,
    resourceAssignmentRepository: schoolRepositories.resourceAssignments,
    studentNoteRepository: schoolRepositories.studentNotes,
    studentHealthProfileRepository: schoolRepositories.studentHealthProfiles,
    studentDisciplinaryActionRepository: schoolRepositories.studentDisciplinaryActions,
    disciplinaryActionRepository: schoolRepositories.disciplinaryActions,
    studentIncidentInvolvementRepository: schoolRepositories.studentIncidentInvolvements,
    incidentRepository: schoolRepositories.incidents,
  }

  const defaultActor = actor ?? createStaffActorMetadata({
    subjectId: 'admin-user',
    staffMemberId: 'admin',
    schoolId: 'school',
    roles: [StaffRole.Admin],
    requestId: 'integration-test',
    authenticatedAt: new Date('2026-09-01T00:00:00Z'),
  })

  const application = new SchoolApplication({
    atomicExecution: createAtomicExecution(transactionParticipants),
    repositories: schoolRepositories,
    authorizationPolicy: new RepositoryAuthorizationPolicy({
      staffAssignmentRepository: schoolRepositories.staffAssignments,
      staffMemberRepository: schoolRepositories.staffMembers,
      guardianRepository: schoolRepositories.guardians,
      guardianStudentLinkRepository: schoolRepositories.guardianLinks,
      studentRepository: schoolRepositories.students,
    }),
    actor: defaultActor,
  })

  if (defaultActor.kind === 'staff') {
    void schoolRepositories.staffMembers.save(new StaffMember({
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

export interface IntegrationTestAdapter {
  createApp: (actor?: ActorMetadata) => ReturnType<typeof createInMemoryTestApp>
}

let activeAdapter: IntegrationTestAdapter = {
  createApp: actor => createInMemoryTestApp(actor),
}

export function setIntegrationTestAdapter(adapter: IntegrationTestAdapter) {
  activeAdapter = adapter
}

export function createTestApp(actor?: ActorMetadata): ReturnType<typeof createInMemoryTestApp> {
  return activeAdapter.createApp(actor)
}
