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
} from '../../entities'
import type { SchoolRepositories } from '../../ports'
import type { ActorMetadata, AuthorizationPolicy, AuthorizationResourceContext } from '../authorization'
import type { ServiceArgs } from '../school-headless-app'
import { AuthorizedReadService } from './authorized-read-service'

export class BaseSchoolQueryService {
  protected readonly repositories: SchoolRepositories
  protected readonly actor: ActorMetadata
  protected readonly authorizationPolicy: AuthorizationPolicy

  public readonly schools: AuthorizedReadService<School>
  public readonly academicYears: AuthorizedReadService<AcademicYear>
  public readonly academicPeriods: AuthorizedReadService<AcademicPeriod>
  public readonly periodDefinitions: AuthorizedReadService<PeriodDefinition>
  public readonly gradeLevels: AuthorizedReadService<GradeLevel>
  public readonly staffMembers: AuthorizedReadService<StaffMember>
  public readonly staffAssignments: AuthorizedReadService<StaffAssignment>
  public readonly attachments: AuthorizedReadService<Attachment>
  public readonly resources: AuthorizedReadService<Resource>
  public readonly resourceAssignments: AuthorizedReadService<ResourceAssignment>

  public readonly fees: AuthorizedReadService<Fee>
  public readonly studentFees: AuthorizedReadService<StudentFee>
  public readonly payments: AuthorizedReadService<Payment>

  public readonly schedules: AuthorizedReadService<Schedule>
  public readonly sessions: AuthorizedReadService<Session>
  public readonly calendarEvents: AuthorizedReadService<CalendarEvent>
  public readonly attendance: AuthorizedReadService<AttendanceRecord>

  public readonly announcements: AuthorizedReadService<Announcement>
  public readonly announcementTargets: AuthorizedReadService<AnnouncementTarget>
  public readonly messageDeliveries: AuthorizedReadService<MessageDelivery>

  public readonly subjects: AuthorizedReadService<Subject>
  public readonly subjectMatters: AuthorizedReadService<SubjectMatter>
  public readonly classGroups: AuthorizedReadService<ClassGroup>
  public readonly classSubjects: AuthorizedReadService<ClassSubject>
  public readonly classSubjectMatters: AuthorizedReadService<ClassSubjectMatter>
  public readonly classSubjectProgress: AuthorizedReadService<ClassSubjectProgress>

  public readonly assessments: AuthorizedReadService<Assessment>
  public readonly assessmentResults: AuthorizedReadService<AssessmentResult>
  public readonly gradeScales: AuthorizedReadService<GradeScale>
  public readonly definitions: AuthorizedReadService<ReportCardDefinition>
  public readonly sections: AuthorizedReadService<ReportCardDefinitionSection>
  public readonly results: AuthorizedReadService<ReportCardResult>

  public readonly students: AuthorizedReadService<Student>
  public readonly enrollments: AuthorizedReadService<StudentClassEnrollment>
  public readonly guardians: AuthorizedReadService<Guardian>
  public readonly guardianLinks: AuthorizedReadService<GuardianStudentLink>
  public readonly studentNotes: AuthorizedReadService<StudentNote>
  public readonly studentHealthProfiles: AuthorizedReadService<StudentHealthProfile>
  public readonly studentDisciplinaryActions: AuthorizedReadService<StudentDisciplinaryAction>
  public readonly disciplinaryActions: AuthorizedReadService<DisciplinaryAction>
  public readonly studentIncidentInvolvements: AuthorizedReadService<StudentIncidentInvolvement>
  public readonly incidents: AuthorizedReadService<Incident>

  constructor(args: ServiceArgs) {
    this.repositories = args.repositories
    this.actor = args.actor
    this.authorizationPolicy = args.authorizationPolicy

    this.schools = new AuthorizedReadService(this.repositories.schools, 'queries.read_workspace', this.actor, this.authorizationPolicy)
    this.academicYears = new AuthorizedReadService(this.repositories.academicYears, 'queries.read_workspace', this.actor, this.authorizationPolicy)
    this.academicPeriods = new AuthorizedReadService(this.repositories.academicPeriods, 'queries.read_workspace', this.actor, this.authorizationPolicy)
    this.periodDefinitions = new AuthorizedReadService(this.repositories.periodDefinitions, 'queries.read_workspace', this.actor, this.authorizationPolicy)
    this.gradeLevels = new AuthorizedReadService(this.repositories.gradeLevels, 'queries.read_class_directory', this.actor, this.authorizationPolicy)
    this.staffMembers = new AuthorizedReadService(this.repositories.staffMembers, 'setup.manage', this.actor, this.authorizationPolicy)
    this.staffAssignments = new AuthorizedReadService(this.repositories.staffAssignments, 'setup.manage', this.actor, this.authorizationPolicy)
    this.attachments = new AuthorizedReadService(this.repositories.attachments, 'attachments.read', this.actor, this.authorizationPolicy)
    this.resources = new AuthorizedReadService(this.repositories.resources, 'resources.read', this.actor, this.authorizationPolicy)
    this.resourceAssignments = new AuthorizedReadService(this.repositories.resourceAssignments, 'resources.read', this.actor, this.authorizationPolicy)

    this.fees = new AuthorizedReadService(this.repositories.fees, 'finance.read', this.actor, this.authorizationPolicy)
    this.studentFees = new AuthorizedReadService(this.repositories.studentFees, 'finance.read', this.actor, this.authorizationPolicy)
    this.payments = new AuthorizedReadService(this.repositories.payments, 'finance.read', this.actor, this.authorizationPolicy)

    this.schedules = new AuthorizedReadService(this.repositories.schedules, 'queries.read_timetable', this.actor, this.authorizationPolicy)
    this.sessions = new AuthorizedReadService(this.repositories.sessions, 'queries.read_timetable', this.actor, this.authorizationPolicy)
    this.calendarEvents = new AuthorizedReadService(this.repositories.calendarEvents, 'queries.read_calendar', this.actor, this.authorizationPolicy)
    this.attendance = new AuthorizedReadService(this.repositories.attendance, 'attendance.read', this.actor, this.authorizationPolicy)

    this.announcements = new AuthorizedReadService(this.repositories.announcements, 'queries.read_communications', this.actor, this.authorizationPolicy)
    this.announcementTargets = new AuthorizedReadService(this.repositories.announcementTargets, 'queries.read_communications', this.actor, this.authorizationPolicy)
    this.messageDeliveries = new AuthorizedReadService(this.repositories.messageDeliveries, 'queries.read_communications', this.actor, this.authorizationPolicy)

    this.subjects = new AuthorizedReadService(this.repositories.subjects, 'queries.read_class_curriculum', this.actor, this.authorizationPolicy)
    this.subjectMatters = new AuthorizedReadService(this.repositories.subjectMatters, 'queries.read_class_curriculum', this.actor, this.authorizationPolicy)
    this.classGroups = new AuthorizedReadService(this.repositories.classGroups, 'queries.read_class_directory', this.actor, this.authorizationPolicy)
    this.classSubjects = new AuthorizedReadService(this.repositories.classSubjects, 'queries.read_class_curriculum', this.actor, this.authorizationPolicy)
    this.classSubjectMatters = new AuthorizedReadService(this.repositories.classSubjectMatters, 'queries.read_class_curriculum', this.actor, this.authorizationPolicy)
    this.classSubjectProgress = new AuthorizedReadService(this.repositories.classSubjectProgress, 'academics.read_progress', this.actor, this.authorizationPolicy)

    this.assessments = new AuthorizedReadService(this.repositories.assessments, 'assessments.read_results', this.actor, this.authorizationPolicy)
    this.assessmentResults = new AuthorizedReadService(this.repositories.assessmentResults, 'assessments.read_results', this.actor, this.authorizationPolicy)
    this.gradeScales = new AuthorizedReadService(this.repositories.gradeScales, 'assessments.read_results', this.actor, this.authorizationPolicy)
    this.definitions = new AuthorizedReadService(this.repositories.definitions, 'queries.read_report_card_detail', this.actor, this.authorizationPolicy)
    this.sections = new AuthorizedReadService(this.repositories.sections, 'queries.read_report_card_detail', this.actor, this.authorizationPolicy)
    this.results = new AuthorizedReadService(this.repositories.results, 'queries.read_report_card_detail', this.actor, this.authorizationPolicy)

    this.students = new AuthorizedReadService(this.repositories.students, 'queries.read_student_directory', this.actor, this.authorizationPolicy)
    this.enrollments = new AuthorizedReadService(this.repositories.enrollments, 'queries.read_enrollment_history', this.actor, this.authorizationPolicy)
    this.guardians = new AuthorizedReadService(this.repositories.guardians, 'queries.read_guardian_students_admin', this.actor, this.authorizationPolicy)
    this.guardianLinks = new AuthorizedReadService(this.repositories.guardianLinks, 'queries.read_guardian_students_admin', this.actor, this.authorizationPolicy)
    this.studentNotes = new AuthorizedReadService(this.repositories.studentNotes, 'queries.read_student_detail', this.actor, this.authorizationPolicy)
    this.studentHealthProfiles = new AuthorizedReadService(this.repositories.studentHealthProfiles, 'queries.read_student_detail', this.actor, this.authorizationPolicy)
    this.studentDisciplinaryActions = new AuthorizedReadService(this.repositories.studentDisciplinaryActions, 'behavior.read_incidents', this.actor, this.authorizationPolicy)
    this.disciplinaryActions = new AuthorizedReadService(this.repositories.disciplinaryActions, 'behavior.read_incidents', this.actor, this.authorizationPolicy)
    this.studentIncidentInvolvements = new AuthorizedReadService(this.repositories.studentIncidentInvolvements, 'behavior.read_incidents', this.actor, this.authorizationPolicy)
    this.incidents = new AuthorizedReadService(this.repositories.incidents, 'behavior.read_incidents', this.actor, this.authorizationPolicy)
  }
}

export class SchoolQueryService extends BaseSchoolQueryService {
  constructor(args: ServiceArgs) {
    super(args)
  }

  async getOverdueFeeCount(schoolId: string, context: AuthorizationResourceContext): Promise<number> {
    await this.authorizationPolicy.requirePermission(this.actor, { action: 'query.get_overdue_fees', resource: context })
    return this.repositories.schools.getOverdueFeeCount(schoolId)
  }

  async getPublishedReportCardCount(schoolId: string, context: AuthorizationResourceContext): Promise<number> {
    await this.authorizationPolicy.requirePermission(this.actor, { action: 'queries.read_report_card_detail', resource: context })
    return this.repositories.schools.getPublishedReportCardCount(schoolId)
  }
}
