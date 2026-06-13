import type { AcademicPeriod, AcademicYear, AccessRole, ActivityEnrollment, Announcement, AnnouncementTarget, Assessment, AssessmentResult, Attachment, AttendanceRecord, CalendarEvent, ClassGroup, ClassLogbookEntry, ClassSubject, ClassSubjectMatter, ClassSubjectProgress, DisciplinaryAction, ExtracurricularActivity, Fee, GradeLevel, GradeScale, Guardian, GuardianStudentLink, HomeworkAssignment, HomeworkSubmission, Incident, MessageDelivery, Payment, PeriodDefinition, ReportCardDefinition, ReportCardDefinitionSection, ReportCardResult, Resource, ResourceAssignment, Schedule, School, SchoolRepositories, Session, StaffAssignment, StaffMember, StaffRoleAssignment, Student, StudentClassEnrollment, StudentDisciplinaryAction, StudentFee, StudentHealthProfile, StudentIncidentInvolvement, StudentNote, Subject, SubjectMatter } from '@edaya/core'
import type { MigrationDriver } from './lib/migrate'
import type { PostgresStore } from './postgres-store'
import { DefaultAuthorizationRepository } from '@edaya/core'
import { runMigrations } from './lib/migrate'
import { clearAllTables } from './lib/schema-init'
import { PostgresAccessRoleStore } from './stores/access-role-store'
import { createEntityStores } from './stores/entity-stores'
import { PostgresStaffRoleAssignmentStore } from './stores/staff-role-assignment-store'

export class PostgresSchoolRepositories implements SchoolRepositories {
  public readonly authorization: DefaultAuthorizationRepository
  public readonly schoolsStore: PostgresStore<School>
  public readonly academicYears: PostgresStore<AcademicYear>
  public readonly academicPeriods: PostgresStore<AcademicPeriod>
  public readonly periodDefinitions: PostgresStore<PeriodDefinition>
  public readonly gradeLevels: PostgresStore<GradeLevel>
  public readonly staffMembers: PostgresStore<StaffMember>
  public readonly staffAssignments: PostgresStore<StaffAssignment>
  public readonly accessRoles: PostgresStore<AccessRole>
  public readonly staffRoleAssignments: PostgresStore<StaffRoleAssignment>
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
  public readonly classLogbookEntries: PostgresStore<ClassLogbookEntry>
  public readonly homeworkAssignments: PostgresStore<HomeworkAssignment>
  public readonly homeworkSubmissions: PostgresStore<HomeworkSubmission>
  public readonly activities: PostgresStore<ExtracurricularActivity>
  public readonly activityEnrollments: PostgresStore<ActivityEnrollment>
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
    const stores = createEntityStores(db)
    this.schoolsStore = stores.schoolsStore
    this.academicYears = stores.academicYears
    this.academicPeriods = stores.academicPeriods
    this.periodDefinitions = stores.periodDefinitions
    this.gradeLevels = stores.gradeLevels
    this.staffMembers = stores.staffMembers
    this.staffAssignments = stores.staffAssignments
    this.attachments = stores.attachments
    this.resources = stores.resources
    this.resourceAssignments = stores.resourceAssignments
    this.fees = stores.fees
    this.studentFees = stores.studentFees
    this.payments = stores.payments
    this.schedules = stores.schedules
    this.sessions = stores.sessions
    this.calendarEvents = stores.calendarEvents
    this.attendance = stores.attendance
    this.announcements = stores.announcements
    this.announcementTargets = stores.announcementTargets
    this.messageDeliveries = stores.messageDeliveries
    this.subjects = stores.subjects
    this.subjectMatters = stores.subjectMatters
    this.classGroups = stores.classGroups
    this.classSubjects = stores.classSubjects
    this.classSubjectMatters = stores.classSubjectMatters
    this.classSubjectProgress = stores.classSubjectProgress
    this.classLogbookEntries = stores.classLogbookEntries
    this.homeworkAssignments = stores.homeworkAssignments
    this.homeworkSubmissions = stores.homeworkSubmissions
    this.activities = stores.activities
    this.activityEnrollments = stores.activityEnrollments
    this.assessments = stores.assessments
    this.assessmentResults = stores.assessmentResults
    this.gradeScales = stores.gradeScales
    this.definitions = stores.definitions
    this.sections = stores.sections
    this.results = stores.results
    this.students = stores.students
    this.enrollments = stores.enrollments
    this.guardians = stores.guardians
    this.guardianLinks = stores.guardianLinks
    this.studentNotes = stores.studentNotes
    this.studentHealthProfiles = stores.studentHealthProfiles
    this.studentDisciplinaryActions = stores.studentDisciplinaryActions
    this.disciplinaryActions = stores.disciplinaryActions
    this.studentIncidentInvolvements = stores.studentIncidentInvolvements
    this.incidents = stores.incidents

    this.accessRoles = new PostgresAccessRoleStore(db)
    this.staffRoleAssignments = new PostgresStaffRoleAssignmentStore(db)
    this.authorization = new DefaultAuthorizationRepository(this)

    this.schools = {
      findById: (id: string) => this.schoolsStore.findById(id),
      findOne: (options, last) => this.schoolsStore.findOne(options, last),
      findByIds: (ids: readonly string[]) => this.schoolsStore.findByIds(ids),
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

  async init(options: { driver: MigrationDriver }): Promise<void> {
    await runMigrations(this.db, options)
  }

  async clearAll(): Promise<void> {
    await clearAllTables(this.db)
  }
}
