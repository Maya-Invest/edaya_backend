import type {
  AtomicExecutionPort,
  SchoolRepositories,
} from '@edaya/core'
import { AsyncLocalStorage } from 'node:async_hooks'
import {
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
} from '@edaya/core'
import { sql } from 'drizzle-orm'
import { entityStore } from './postgres-schema'
import { PostgresStore } from './postgres-store'

export const transactionContext = new AsyncLocalStorage<any>()

export class PostgresAtomicExecution implements AtomicExecutionPort {
  constructor(private readonly db: any) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    return await this.db.transaction(async (tx: any) => {
      return await transactionContext.run(tx, async () => {
        return await operation()
      })
    })
  }
}

export class PostgresSchoolRepositories implements SchoolRepositories {
  public readonly schoolsStore: PostgresStore<School>
  public readonly academicYears: PostgresStore<AcademicYear>
  public readonly academicPeriods: PostgresStore<AcademicPeriod>
  public readonly periodDefinitions: PostgresStore<PeriodDefinition>
  public readonly gradeLevels: PostgresStore<GradeLevel>
  public readonly staffMembers: PostgresStore<StaffMember>
  public readonly staffAssignments: PostgresStore<StaffAssignment>
  public readonly attachments: PostgresStore<Attachment>
  public readonly resources: PostgresStore<Resource>
  public readonly resourceAssignments: PostgresStore<ResourceAssignment>

  public readonly fees: PostgresStore<Fee>
  public readonly studentFees: PostgresStore<StudentFee>
  public readonly payments: PostgresStore<Payment>

  public readonly schedules: PostgresStore<Schedule>
  public readonly sessions: PostgresStore<Session>
  public readonly calendarEvents: PostgresStore<CalendarEvent>
  public readonly attendance: PostgresStore<AttendanceRecord>

  public readonly announcements: PostgresStore<Announcement>
  public readonly announcementTargets: PostgresStore<AnnouncementTarget>
  public readonly messageDeliveries: PostgresStore<MessageDelivery>

  public readonly subjects: PostgresStore<Subject>
  public readonly subjectMatters: PostgresStore<SubjectMatter>
  public readonly classGroups: PostgresStore<ClassGroup>
  public readonly classSubjects: PostgresStore<ClassSubject>
  public readonly classSubjectMatters: PostgresStore<ClassSubjectMatter>
  public readonly classSubjectProgress: PostgresStore<ClassSubjectProgress>

  public readonly assessments: PostgresStore<Assessment>
  public readonly assessmentResults: PostgresStore<AssessmentResult>
  public readonly gradeScales: PostgresStore<GradeScale>
  public readonly definitions: PostgresStore<ReportCardDefinition>
  public readonly sections: PostgresStore<ReportCardDefinitionSection>
  public readonly results: PostgresStore<ReportCardResult>

  public readonly students: PostgresStore<Student>
  public readonly enrollments: PostgresStore<StudentClassEnrollment>
  public readonly guardians: PostgresStore<Guardian>
  public readonly guardianLinks: PostgresStore<GuardianStudentLink>
  public readonly studentNotes: PostgresStore<StudentNote>
  public readonly studentHealthProfiles: PostgresStore<StudentHealthProfile>
  public readonly studentDisciplinaryActions: PostgresStore<StudentDisciplinaryAction>
  public readonly disciplinaryActions: PostgresStore<DisciplinaryAction>
  public readonly studentIncidentInvolvements: PostgresStore<StudentIncidentInvolvement>
  public readonly incidents: PostgresStore<Incident>

  public readonly schools: SchoolRepositories['schools']

  constructor(private readonly db: any) {
    this.schoolsStore = new PostgresStore(db, 'School', School)
    this.academicYears = new PostgresStore(db, 'AcademicYear', AcademicYear)
    this.academicPeriods = new PostgresStore(db, 'AcademicPeriod', AcademicPeriod)
    this.periodDefinitions = new PostgresStore(db, 'PeriodDefinition', PeriodDefinition)
    this.gradeLevels = new PostgresStore(db, 'GradeLevel', GradeLevel)
    this.staffMembers = new PostgresStore(db, 'StaffMember', StaffMember)
    this.staffAssignments = new PostgresStore(db, 'StaffAssignment', StaffAssignment)
    this.attachments = new PostgresStore(db, 'Attachment', Attachment)
    this.resources = new PostgresStore(db, 'Resource', Resource)
    this.resourceAssignments = new PostgresStore(db, 'ResourceAssignment', ResourceAssignment)

    this.fees = new PostgresStore(db, 'Fee', Fee)
    this.studentFees = new PostgresStore(db, 'StudentFee', StudentFee)
    this.payments = new PostgresStore(db, 'Payment', Payment)

    this.schedules = new PostgresStore(db, 'Schedule', Schedule)
    this.sessions = new PostgresStore(db, 'Session', Session)
    this.calendarEvents = new PostgresStore(db, 'CalendarEvent', CalendarEvent)
    this.attendance = new PostgresStore(db, 'AttendanceRecord', AttendanceRecord)

    this.announcements = new PostgresStore(db, 'Announcement', Announcement)
    this.announcementTargets = new PostgresStore(db, 'AnnouncementTarget', AnnouncementTarget)
    this.messageDeliveries = new PostgresStore(db, 'MessageDelivery', MessageDelivery)

    this.subjects = new PostgresStore(db, 'Subject', Subject)
    this.subjectMatters = new PostgresStore(db, 'SubjectMatter', SubjectMatter)
    this.classGroups = new PostgresStore(db, 'ClassGroup', ClassGroup)
    this.classSubjects = new PostgresStore(db, 'ClassSubject', ClassSubject)
    this.classSubjectMatters = new PostgresStore(db, 'ClassSubjectMatter', ClassSubjectMatter)
    this.classSubjectProgress = new PostgresStore(db, 'ClassSubjectProgress', ClassSubjectProgress)

    this.assessments = new PostgresStore(db, 'Assessment', Assessment)
    this.assessmentResults = new PostgresStore(db, 'AssessmentResult', AssessmentResult)
    this.gradeScales = new PostgresStore(db, 'GradeScale', GradeScale)
    this.definitions = new PostgresStore(db, 'ReportCardDefinition', ReportCardDefinition)
    this.sections = new PostgresStore(db, 'ReportCardDefinitionSection', ReportCardDefinitionSection)
    this.results = new PostgresStore(db, 'ReportCardResult', ReportCardResult)

    this.students = new PostgresStore(db, 'Student', Student)
    this.enrollments = new PostgresStore(db, 'StudentClassEnrollment', StudentClassEnrollment)
    this.guardians = new PostgresStore(db, 'Guardian', Guardian)
    this.guardianLinks = new PostgresStore(db, 'GuardianStudentLink', GuardianStudentLink)
    this.studentNotes = new PostgresStore(db, 'StudentNote', StudentNote)
    this.studentHealthProfiles = new PostgresStore(db, 'StudentHealthProfile', StudentHealthProfile)
    this.studentDisciplinaryActions = new PostgresStore(db, 'StudentDisciplinaryAction', StudentDisciplinaryAction)
    this.disciplinaryActions = new PostgresStore(db, 'DisciplinaryAction', DisciplinaryAction)
    this.studentIncidentInvolvements = new PostgresStore(db, 'StudentIncidentInvolvement', StudentIncidentInvolvement)
    this.incidents = new PostgresStore(db, 'Incident', Incident)

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

  async init(): Promise<void> {
    await this.db.execute(sql`
      CREATE TABLE IF NOT EXISTS entity_store (
        entity_type TEXT NOT NULL,
        id TEXT NOT NULL,
        data JSONB NOT NULL,
        PRIMARY KEY (entity_type, id)
      );
    `)
  }

  async clearAll(): Promise<void> {
    await this.db.delete(entityStore)
  }
}
