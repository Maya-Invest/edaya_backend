import type {
  AcademicPeriod,
  AcademicYear,
  Announcement,
  AnnouncementTarget,
  Assessment,
  AssessmentResult,
  AtomicExecutionPort,
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
  SchoolRepositories,
  Session,
  StaffAssignment,
  StaffMember,
  Student,
  StudentClassEnrollment,
  StudentDisciplinaryAction,
  StudentFee,
  StudentHealthProfile,
  StudentIncidentInvolvement,
  StudentNote,
  Subject,
  SubjectMatter,
} from 'maya_school_core'
import type { TransactionParticipant } from './in-memory-store'
import { InMemoryStore } from './in-memory-store'

export class InMemoryAtomicExecution implements AtomicExecutionPort {
  constructor(private readonly participants: readonly TransactionParticipant[]) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    for (const participant of this.participants) {
      participant.begin()
    }
    try {
      const result = await operation()
      for (const participant of this.participants) {
        participant.commit()
      }
      return result
    }
    catch (error) {
      for (const participant of this.participants) {
        participant.rollback()
      }
      throw error
    }
  }
}

export class InMemorySchoolRepositories implements SchoolRepositories {
  // Store all individual participants for transactions
  public readonly transactionParticipants: TransactionParticipant[] = []

  // Exposed Repository Stores
  public readonly schoolsStore = new InMemoryStore<School>()
  public readonly academicYears = new InMemoryStore<AcademicYear>()
  public readonly academicPeriods = new InMemoryStore<AcademicPeriod>()
  public readonly periodDefinitions = new InMemoryStore<PeriodDefinition>()
  public readonly gradeLevels = new InMemoryStore<GradeLevel>()
  public readonly staffMembers = new InMemoryStore<StaffMember>()
  public readonly staffAssignments = new InMemoryStore<StaffAssignment>()
  public readonly attachments = new InMemoryStore<Attachment>()
  public readonly resources = new InMemoryStore<Resource>()
  public readonly resourceAssignments = new InMemoryStore<ResourceAssignment>()

  // FinanceRepositories
  public readonly fees = new InMemoryStore<Fee>()
  public readonly studentFees = new InMemoryStore<StudentFee>()
  public readonly payments = new InMemoryStore<Payment>()

  // SchedulingRepositories
  public readonly schedules = new InMemoryStore<Schedule>()
  public readonly sessions = new InMemoryStore<Session>()
  public readonly calendarEvents = new InMemoryStore<CalendarEvent>()
  public readonly attendance = new InMemoryStore<AttendanceRecord>()

  // CommunicationRepositories
  public readonly announcements = new InMemoryStore<Announcement>()
  public readonly announcementTargets = new InMemoryStore<AnnouncementTarget>()
  public readonly messageDeliveries = new InMemoryStore<MessageDelivery>()

  // AcademicsRepositories
  public readonly subjects = new InMemoryStore<Subject>()
  public readonly subjectMatters = new InMemoryStore<SubjectMatter>()
  public readonly classGroups = new InMemoryStore<ClassGroup>()
  public readonly classSubjects = new InMemoryStore<ClassSubject>()
  public readonly classSubjectMatters = new InMemoryStore<ClassSubjectMatter>()
  public readonly classSubjectProgress = new InMemoryStore<ClassSubjectProgress>()

  // AssessmentRepositories
  public readonly assessments = new InMemoryStore<Assessment>()
  public readonly assessmentResults = new InMemoryStore<AssessmentResult>()
  public readonly gradeScales = new InMemoryStore<GradeScale>()
  public readonly definitions = new InMemoryStore<ReportCardDefinition>()
  public readonly sections = new InMemoryStore<ReportCardDefinitionSection>()
  public readonly results = new InMemoryStore<ReportCardResult>()

  // StudentRepositories
  public readonly students = new InMemoryStore<Student>()
  public readonly enrollments = new InMemoryStore<StudentClassEnrollment>()
  public readonly guardians = new InMemoryStore<Guardian>()
  public readonly guardianLinks = new InMemoryStore<GuardianStudentLink>()
  public readonly studentNotes = new InMemoryStore<StudentNote>()
  public readonly studentHealthProfiles = new InMemoryStore<StudentHealthProfile>()
  public readonly studentDisciplinaryActions = new InMemoryStore<StudentDisciplinaryAction>()
  public readonly disciplinaryActions = new InMemoryStore<DisciplinaryAction>()
  public readonly studentIncidentInvolvements = new InMemoryStore<StudentIncidentInvolvement>()
  public readonly incidents = new InMemoryStore<Incident>()

  // Composed schools repository matching specialized methods
  public readonly schools: SchoolRepositories['schools']

  constructor() {
    // Collect all stores to register as transaction participants
    const stores = [
      this.schoolsStore,
      this.academicYears,
      this.academicPeriods,
      this.periodDefinitions,
      this.gradeLevels,
      this.staffMembers,
      this.staffAssignments,
      this.attachments,
      this.resources,
      this.resourceAssignments,
      this.fees,
      this.studentFees,
      this.payments,
      this.schedules,
      this.sessions,
      this.calendarEvents,
      this.attendance,
      this.announcements,
      this.announcementTargets,
      this.messageDeliveries,
      this.subjects,
      this.subjectMatters,
      this.classGroups,
      this.classSubjects,
      this.classSubjectMatters,
      this.classSubjectProgress,
      this.assessments,
      this.assessmentResults,
      this.gradeScales,
      this.definitions,
      this.sections,
      this.results,
      this.students,
      this.enrollments,
      this.guardians,
      this.guardianLinks,
      this.studentNotes,
      this.studentHealthProfiles,
      this.studentDisciplinaryActions,
      this.disciplinaryActions,
      this.studentIncidentInvolvements,
      this.incidents,
    ]

    for (const store of stores) {
      this.transactionParticipants.push(store)
    }

    // Decorate the schools store with the custom methods
    this.schools = {
      findById: (id: string) => this.schoolsStore.findById(id),
      findOne: (options, last) => this.schoolsStore.findOne(options, last),
      findByIds: (ids: string[]) => this.schoolsStore.findByIds(ids),
      list: options => this.schoolsStore.list(options),
      count: filter => this.schoolsStore.count(filter),
      save: (entity: School) => this.schoolsStore.save(entity),
      delete: (id: string) => this.schoolsStore.delete(id),
      batchSave: (entities: School[]) => this.schoolsStore.batchSave(entities),
      batchDelete: (ids: string[]) => this.schoolsStore.batchDelete(ids),
      getOverdueFeeCount: async (schoolId: string): Promise<number> => {
        const schoolStudents = await this.students.list({ schoolId })
        const studentIds = new Set(schoolStudents.map(s => s.id))
        const allFees = await this.studentFees.list()
        return allFees.filter(f => studentIds.has(f.studentId) && f.status === 'overdue').length
      },
      getPublishedReportCardCount: async (schoolId: string): Promise<number> => {
        const schoolStudents = await this.students.list({ schoolId })
        const studentIds = new Set(schoolStudents.map(s => s.id))
        const rcs = await this.results.list()
        return rcs.filter(rc => studentIds.has(rc.studentId) && rc.status === 'published').length
      },
    }
  }

  // Utility to clear all repositories (primarily for testing and context resetting)
  public clearAll(): void {
    this.schoolsStore.clear()
    this.academicYears.clear()
    this.academicPeriods.clear()
    this.periodDefinitions.clear()
    this.gradeLevels.clear()
    this.staffMembers.clear()
    this.staffAssignments.clear()
    this.attachments.clear()
    this.resources.clear()
    this.resourceAssignments.clear()
    this.fees.clear()
    this.studentFees.clear()
    this.payments.clear()
    this.schedules.clear()
    this.sessions.clear()
    this.calendarEvents.clear()
    this.attendance.clear()
    this.announcements.clear()
    this.announcementTargets.clear()
    this.messageDeliveries.clear()
    this.subjects.clear()
    this.subjectMatters.clear()
    this.classGroups.clear()
    this.classSubjects.clear()
    this.classSubjectMatters.clear()
    this.classSubjectProgress.clear()
    this.assessments.clear()
    this.assessmentResults.clear()
    this.gradeScales.clear()
    this.definitions.clear()
    this.sections.clear()
    this.results.clear()
    this.students.clear()
    this.enrollments.clear()
    this.guardians.clear()
    this.guardianLinks.clear()
    this.studentNotes.clear()
    this.studentHealthProfiles.clear()
    this.studentDisciplinaryActions.clear()
    this.disciplinaryActions.clear()
    this.studentIncidentInvolvements.clear()
    this.incidents.clear()
  }
}
