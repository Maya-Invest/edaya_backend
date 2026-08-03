import type { ActorMetadata } from '@edaya/authorization'
import type { AcademicPeriod, AcademicYear, AccountInvitation, AccountInvitationKind, Activity, ActivityEnrollment, ActivitySession, Announcement, AnnouncementTarget, Assessment, AssessmentResult, Attachment, Attendance, AttendanceRecord, BaseRepositoryInterface, CalendarEvent, ClassActivityEnrollment, ClassGroup, ClassSubject, ClassSubjectMatter, ClassSubjectProgress, DisciplinaryAction, Fee, Filter, GradeLevel, GradeLevelSubject, GradeLevelSubjectMatter, GradeScale, Guardian, GuardianStudentLink, Incident, LessonSession, MessageDelivery, Payment, PeriodDefinition, QueryOptions, ReportCardDefinition, ReportCardDefinitionSection, ReportCardResult, Resource, ResourceAssignment, Schedule, School, SchoolNotificationTemplates, ServiceApiKey, StaffAssignment, StaffPermissionAssignment, Student, StudentClassEnrollment, StudentDisciplinaryAction, StudentFee, StudentHealthProfile, StudentIncidentInvolvement, StudentNote, Subject, SubjectMatter, Teacher, TeacherAssignment, TeacherUnavailability } from '@edaya/core'
import type { SchoolRepositories } from '@edaya/service'
import {
  ActorAssuranceLevel,
  createRepositoryAuthorizationPolicy,
  createStaffActorMetadata,
  DefaultAuthorizationRepository,
} from '@edaya/authorization'
import { AccountInvitationStatus, noOpNotificationGateway, StaffMember } from '@edaya/core'
import { buildSchoolOverview, SchoolApplication } from '@edaya/service'
import { effectiveGrantsForRoles } from './effective-grants'
import { matchesFilter } from './filter-matcher'
import { testFileStorage } from './test-file-storage'

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
  const store = {
    findById: async (id: string) => entries.get(id),
    findByIds: async (ids: readonly string[]) => ids.map(id => entries.get(id)).filter((entity): entity is T => entity !== undefined),
    findOne: async (options?: Filter<T>) => {
      const results = await store.list(options)
      return results[0]
    },
    list: async (options?: QueryOptions<T>) => {
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
    batchDelete: async (ids: readonly string[]) => {
      for (const id of ids) {
        entries.delete(id)
      }
    },
  }
  return store
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
    | 'lessonSessionRepository'
    | 'activitySessionRepository'
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
  const teachers = createStore<Teacher>(transactionParticipants)
  const teacherAssignments = createStore<TeacherAssignment>(transactionParticipants)
  const teacherUnavailabilities = createStore<TeacherUnavailability>(transactionParticipants)
  const serviceApiKeyStore = createStore<ServiceApiKey>(transactionParticipants)
  const serviceApiKeys = {
    ...serviceApiKeyStore,
    findActiveByHash: async (keyHash: string, now: Date = new Date()) => {
      const keys = await serviceApiKeyStore.list()
      return keys.find(key => key.keyHash === keyHash && key.isActive(now))
    },
    countActiveElevatedServiceAccounts: async (schoolId: string) => {
      const staff = await staffMembers.list({ schoolId, accountKind: 'service', serviceElevated: true, isActive: true })
      return staff.length
    },
  }
  const accountInvitationStore = createStore<AccountInvitation>(transactionParticipants)
  const schoolNotificationTemplates = createStore<SchoolNotificationTemplates>(transactionParticipants)
  const accountInvitations = {
    ...accountInvitationStore,
    findByTokenHash: async (tokenHash: string) => {
      const rows = await accountInvitationStore.list({ tokenHash })
      return rows[0]
    },
    findPendingByTarget: async (schoolId: string, kind: AccountInvitationKind, targetId: string) => {
      const rows = await accountInvitationStore.list({
        schoolId,
        kind,
        targetId,
        status: AccountInvitationStatus.Pending,
      })
      return rows[0]
    },
  }
  const staffPermissionAssignments = createStore<StaffPermissionAssignment>(transactionParticipants)
  const subjects = createStore<Subject>(transactionParticipants)
  const subjectMatters = createStore<SubjectMatter>(transactionParticipants)
  const gradeLevelSubjects = createStore<GradeLevelSubject>(transactionParticipants)
  const gradeLevelSubjectMatters = createStore<GradeLevelSubjectMatter>(transactionParticipants)
  const classSubjects = createStore<ClassSubject>(transactionParticipants)
  const classSubjectMatters = createStore<ClassSubjectMatter>(transactionParticipants)
  const classSubjectProgress = createStore<ClassSubjectProgress>(transactionParticipants)
  const activities = createStore<Activity>(transactionParticipants)
  const activityEnrollments = createStore<ActivityEnrollment>(transactionParticipants)
  const classActivityEnrollments = createStore<ClassActivityEnrollment>(transactionParticipants)
  const lessonSessions = createStore<LessonSession>(transactionParticipants)
  const activitySessions = createStore<ActivitySession>(transactionParticipants)
  const attendances = createStore<Attendance>(transactionParticipants)
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
    authorization: undefined as any,
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
      getSchoolOverview: input => buildSchoolOverview(schoolRepositories, input),
    },
    academicYears,
    academicPeriods,
    periodDefinitions,
    gradeLevels,
    staffMembers,
    staffAssignments,
    teachers,
    teacherAssignments,
    teacherUnavailabilities,
    serviceApiKeys,
    accountInvitations,
    cronJobSchedules: {
      listDue: async () => [],
      markDispatched: async () => {},
    },
    schoolNotificationTemplates,
    staffPermissionAssignments,
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
    lessonSessions: {
      ...lessonSessions,
      save: entity => saveWithFailure('lessonSessionRepository', lessonSessions, entity),
    },
    activitySessions: {
      ...activitySessions,
      save: entity => saveWithFailure('activitySessionRepository', activitySessions, entity),
    },
    attendances: {
      ...attendances,
    },
    attendance: {
      ...attendance,
    },
    calendarEvents,

    // academics
    subjects,
    subjectMatters,
    gradeLevelSubjects,
    gradeLevelSubjectMatters,
    classGroups,
    classSubjects,
    classSubjectMatters: {
      ...classSubjectMatters,
      save: entity => saveWithFailure('classSubjectMatterRepository', classSubjectMatters, entity),
    },
    classSubjectProgress,
    activities,
    activityEnrollments,
    classActivityEnrollments,

    // assessments
    assessments,
    assessmentResults,
    gradeScales,
    definitions,
    sections,
    results: {
      ...results,
      save: entity => saveWithFailure('reportCardResultRepository', results, entity),
    },

    // students
    students,
    enrollments: {
      ...enrollments,
      save: entity => saveWithFailure('studentClassEnrollmentRepository', enrollments, entity),
    },
    guardians,
    guardianLinks,
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

  // @ts-expect-error - dynamic assignment of authorization repository
  schoolRepositories.authorization = new DefaultAuthorizationRepository(schoolRepositories)

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
    schools: schoolRepositories.schools,
    students: schoolRepositories.students,
    staffMembers: schoolRepositories.staffMembers,
    studentFees: schoolRepositories.studentFees,
    payments: schoolRepositories.payments,
    attendance: schoolRepositories.attendance,
    incidents: schoolRepositories.incidents,
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
    teacherRepository: schoolRepositories.teachers,
    teacherAssignmentRepository: schoolRepositories.teacherAssignments,
    subjectRepository: schoolRepositories.subjects,
    subjectMatterRepository: schoolRepositories.subjectMatters,
    classSubjectRepository: schoolRepositories.classSubjects,
    classSubjectMatterRepository: schoolRepositories.classSubjectMatters,
    classSubjectProgressRepository: schoolRepositories.classSubjectProgress,
    lessonSessionRepository: schoolRepositories.lessonSessions,
    attendanceOccurrenceRepository: schoolRepositories.attendances,
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
    schoolNotificationTemplates: schoolRepositories.schoolNotificationTemplates,
  }

  const defaultActor = actor ?? createStaffActorMetadata({
    subjectId: 'admin-user',
    staffMemberId: 'admin',
    schoolId: 'school',
    effectiveGrants: effectiveGrantsForRoles(['admin']),
    requestId: 'integration-test',
    authenticatedAt: new Date('2026-09-01T00:00:00Z'),
    assuranceLevel: ActorAssuranceLevel.Strong,
  })

  const application = new SchoolApplication({
    atomicExecution: createAtomicExecution(transactionParticipants),
    notificationGateway: noOpNotificationGateway,
    fileStorage: testFileStorage,
    repositories: schoolRepositories,
    authorizationPolicy: createRepositoryAuthorizationPolicy({
      repositories: schoolRepositories,
      staffAssignmentRepository: schoolRepositories.staffAssignments,
      staffMemberRepository: schoolRepositories.staffMembers,
      guardianRepository: schoolRepositories.guardians,
      guardianStudentLinkRepository: schoolRepositories.guardianLinks,
      studentRepository: schoolRepositories.students,
    }),
  })

  if (defaultActor.kind === 'staff') {
    void schoolRepositories.staffMembers.save(new StaffMember({
      id: defaultActor.staffMemberId,
      schoolId: defaultActor.schoolId,
      firstName: 'Fixture',
      lastName: 'Administrator',
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
