import type { AcademicPeriod, AcademicYear, Activity, ActivityEnrollment, ActivitySession, Announcement, AnnouncementTarget, Assessment, AssessmentResult, Attachment, Attendance, AttendanceRecord, CalendarEvent, ClassActivityEnrollment, ClassGroup, ClassSubject, ClassSubjectMatter, ClassSubjectProgress, DisciplinaryAction, Fee, GradeLevel, GradeLevelSubject, GradeLevelSubjectMatter, GradeScale, Guardian, GuardianStudentLink, Incident, LessonSession, MessageDelivery, Payment, PeriodDefinition, ReportCardDefinition, ReportCardDefinitionSection, ReportCardResult, Resource, ResourceAssignment, Schedule, School, StaffAssignment, StaffMember, StaffPermissionAssignment, Student, StudentClassEnrollment, StudentDisciplinaryAction, StudentFee, StudentHealthProfile, StudentIncidentInvolvement, StudentNote, Subject, SubjectMatter, Teacher, TeacherAssignment } from '@edaya/core'
import type { SchoolRepositories } from '@edaya/service'
import type { MigrationDriver } from './lib/migrate'
import type { PostgresStore } from './postgres-store'
import { DefaultAuthorizationRepository } from '@edaya/authorization'
import { buildSchoolOverview } from '@edaya/service'
import { runMigrations } from './lib/migrate'
import { clearAllTables } from './lib/schema-init'
import { PostgresAccountInvitationStore } from './stores/account-invitation-store'
import { PostgresCronJobScheduleStore } from './stores/cron-job-schedule-store'
import { createEntityStores } from './stores/entity-stores'
import { PostgresSchoolNotificationTemplatesStore } from './stores/school-notification-templates-store'
import { PostgresServiceApiKeyStore } from './stores/service-api-key-store'
import { PostgresStaffPermissionAssignmentStore } from './stores/staff-permission-assignment-store'

export class PostgresSchoolRepositories implements SchoolRepositories {
  public readonly authorization: DefaultAuthorizationRepository
  public readonly schoolsStore: PostgresStore<School>
  public readonly academicYears: PostgresStore<AcademicYear>
  public readonly academicPeriods: PostgresStore<AcademicPeriod>
  public readonly periodDefinitions: PostgresStore<PeriodDefinition>
  public readonly gradeLevels: PostgresStore<GradeLevel>
  public readonly staffMembers: PostgresStore<StaffMember>
  public readonly staffAssignments: PostgresStore<StaffAssignment>
  public readonly teachers: PostgresStore<Teacher>
  public readonly teacherAssignments: PostgresStore<TeacherAssignment>
  public readonly serviceApiKeys: PostgresServiceApiKeyStore
  public readonly accountInvitations: PostgresAccountInvitationStore
  public readonly cronJobSchedules: PostgresCronJobScheduleStore
  public readonly schoolNotificationTemplates: PostgresSchoolNotificationTemplatesStore
  public readonly staffPermissionAssignments: PostgresStore<StaffPermissionAssignment>
  public readonly attachments: PostgresStore<Attachment>
  public readonly resources: PostgresStore<Resource>
  public readonly resourceAssignments: PostgresStore<ResourceAssignment>
  public readonly fees: PostgresStore<Fee>
  public readonly studentFees: PostgresStore<StudentFee>
  public readonly payments: PostgresStore<Payment>
  public readonly schedules: PostgresStore<Schedule>
  public readonly attendances: PostgresStore<Attendance>
  public readonly lessonSessions: PostgresStore<LessonSession>
  public readonly activitySessions: PostgresStore<ActivitySession>
  public readonly calendarEvents: PostgresStore<CalendarEvent>
  public readonly attendance: PostgresStore<AttendanceRecord>
  public readonly announcements: PostgresStore<Announcement>
  public readonly announcementTargets: PostgresStore<AnnouncementTarget>
  public readonly messageDeliveries: PostgresStore<MessageDelivery>
  public readonly subjects: PostgresStore<Subject>
  public readonly subjectMatters: PostgresStore<SubjectMatter>
  public readonly gradeLevelSubjects: PostgresStore<GradeLevelSubject>
  public readonly gradeLevelSubjectMatters: PostgresStore<GradeLevelSubjectMatter>
  public readonly classGroups: PostgresStore<ClassGroup>
  public readonly classSubjects: PostgresStore<ClassSubject>
  public readonly classSubjectMatters: PostgresStore<ClassSubjectMatter>
  public readonly classSubjectProgress: PostgresStore<ClassSubjectProgress>
  public readonly activities: PostgresStore<Activity>
  public readonly activityEnrollments: PostgresStore<ActivityEnrollment>
  public readonly classActivityEnrollments: PostgresStore<ClassActivityEnrollment>
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
    this.teachers = stores.teachers
    this.teacherAssignments = stores.teacherAssignments
    this.serviceApiKeys = new PostgresServiceApiKeyStore(db)
    this.accountInvitations = new PostgresAccountInvitationStore(db)
    this.cronJobSchedules = new PostgresCronJobScheduleStore(db)
    this.schoolNotificationTemplates = new PostgresSchoolNotificationTemplatesStore(db)
    this.attachments = stores.attachments
    this.resources = stores.resources
    this.resourceAssignments = stores.resourceAssignments
    this.fees = stores.fees
    this.studentFees = stores.studentFees
    this.payments = stores.payments
    this.schedules = stores.schedules
    this.attendances = stores.attendances
    this.lessonSessions = stores.lessonSessions
    this.activitySessions = stores.activitySessions
    this.calendarEvents = stores.calendarEvents
    this.attendance = stores.attendance
    this.announcements = stores.announcements
    this.announcementTargets = stores.announcementTargets
    this.messageDeliveries = stores.messageDeliveries
    this.subjects = stores.subjects
    this.subjectMatters = stores.subjectMatters
    this.gradeLevelSubjects = stores.gradeLevelSubjects
    this.gradeLevelSubjectMatters = stores.gradeLevelSubjectMatters
    this.classGroups = stores.classGroups
    this.classSubjects = stores.classSubjects
    this.classSubjectMatters = stores.classSubjectMatters
    this.classSubjectProgress = stores.classSubjectProgress
    this.activities = stores.activities
    this.activityEnrollments = stores.activityEnrollments
    this.classActivityEnrollments = stores.classActivityEnrollments
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

    this.staffPermissionAssignments = new PostgresStaffPermissionAssignmentStore(db)
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
      getSchoolOverview: input => buildSchoolOverview(this, input),
    }
  }

  async init(options: { driver: MigrationDriver }): Promise<void> {
    await runMigrations(this.db, options)
  }

  async clearAll(): Promise<void> {
    await clearAllTables(this.db)
  }
}
