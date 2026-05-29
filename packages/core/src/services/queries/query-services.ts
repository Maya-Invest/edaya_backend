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
import type { ActorMetadata, AuthorizationPolicy } from '../authorization'
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

    const checkWorkspace = async (actor: ActorMetadata) => this.authorizationPolicy.checkGlobalAction(actor, 'queries.read_workspace')
    const checkClassDirectory = async (actor: ActorMetadata) => this.authorizationPolicy.checkGlobalAction(actor, 'queries.read_class_directory')
    const checkSetupManage = async (actor: ActorMetadata) => this.authorizationPolicy.checkGlobalAction(actor, 'setup.manage')
    const checkAttachmentsRead = async (actor: ActorMetadata) => this.authorizationPolicy.checkGlobalAction(actor, 'attachments.read')
    const checkResourcesRead = async (actor: ActorMetadata) => this.authorizationPolicy.checkGlobalAction(actor, 'resources.read')
    const checkFinanceRead = async (actor: ActorMetadata) => this.authorizationPolicy.checkGlobalAction(actor, 'finance.read')
    const checkTimetableRead = async (actor: ActorMetadata) => this.authorizationPolicy.checkGlobalAction(actor, 'queries.read_timetable')
    const checkCalendarRead = async (actor: ActorMetadata) => this.authorizationPolicy.checkGlobalAction(actor, 'queries.read_calendar')
    const checkAttendanceRead = async (actor: ActorMetadata) => this.authorizationPolicy.checkGlobalAction(actor, 'attendance.read')
    const checkCommunicationsRead = async (actor: ActorMetadata) => this.authorizationPolicy.checkGlobalAction(actor, 'queries.read_communications')
    const checkCurriculumRead = async (actor: ActorMetadata) => this.authorizationPolicy.checkGlobalAction(actor, 'queries.read_class_curriculum')
    const checkAcademicsReadProgress = async (actor: ActorMetadata) => this.authorizationPolicy.checkGlobalAction(actor, 'academics.read_progress')
    const checkAssessmentsReadResults = async (actor: ActorMetadata) => this.authorizationPolicy.checkGlobalAction(actor, 'assessments.read_results')
    const checkReportCardReadDetail = async (actor: ActorMetadata) => this.authorizationPolicy.checkGlobalAction(actor, 'queries.read_report_card_detail')
    const checkStudentDirectoryRead = async (actor: ActorMetadata) => this.authorizationPolicy.checkGlobalAction(actor, 'queries.read_student_directory')
    const checkEnrollmentHistoryRead = async (actor: ActorMetadata) => this.authorizationPolicy.checkGlobalAction(actor, 'queries.read_enrollment_history')
    const checkGuardianAdminRead = async (actor: ActorMetadata) => this.authorizationPolicy.checkGlobalAction(actor, 'queries.read_guardian_students_admin')
    const checkStudentDetailRead = async (actor: ActorMetadata) => this.authorizationPolicy.checkGlobalAction(actor, 'queries.read_student_detail')
    const checkBehaviorReadIncidents = async (actor: ActorMetadata) => this.authorizationPolicy.checkGlobalAction(actor, 'behavior.read_incidents')

    this.schools = new AuthorizedReadService(this.repositories.schools, this.actor, checkWorkspace, checkWorkspace)
    this.academicYears = new AuthorizedReadService(this.repositories.academicYears, this.actor, checkWorkspace, checkWorkspace)
    this.academicPeriods = new AuthorizedReadService(this.repositories.academicPeriods, this.actor, checkWorkspace, checkWorkspace)
    this.periodDefinitions = new AuthorizedReadService(this.repositories.periodDefinitions, this.actor, checkWorkspace, checkWorkspace)
    this.gradeLevels = new AuthorizedReadService(this.repositories.gradeLevels, this.actor, checkClassDirectory, checkClassDirectory)
    this.staffMembers = new AuthorizedReadService(this.repositories.staffMembers, this.actor, checkSetupManage, checkSetupManage)
    this.staffAssignments = new AuthorizedReadService(this.repositories.staffAssignments, this.actor, checkSetupManage, checkSetupManage)
    this.attachments = new AuthorizedReadService(this.repositories.attachments, this.actor, checkAttachmentsRead, checkAttachmentsRead)
    this.resources = new AuthorizedReadService(this.repositories.resources, this.actor, checkResourcesRead, checkResourcesRead)
    this.resourceAssignments = new AuthorizedReadService(this.repositories.resourceAssignments, this.actor, checkResourcesRead, checkResourcesRead)

    this.fees = new AuthorizedReadService(this.repositories.fees, this.actor, checkFinanceRead, async (actor, ids) => this.authorizationPolicy.checkFeeAccess(actor, ids))
    this.studentFees = new AuthorizedReadService(this.repositories.studentFees, this.actor, checkFinanceRead, async (actor, ids) => this.authorizationPolicy.checkStudentFeeAccess(actor, ids))
    this.payments = new AuthorizedReadService(this.repositories.payments, this.actor, checkFinanceRead, checkFinanceRead)

    this.schedules = new AuthorizedReadService(this.repositories.schedules, this.actor, checkTimetableRead, checkTimetableRead)
    this.sessions = new AuthorizedReadService(this.repositories.sessions, this.actor, checkTimetableRead, async (actor, ids) => this.authorizationPolicy.checkSessionAccess(actor, ids))
    this.calendarEvents = new AuthorizedReadService(this.repositories.calendarEvents, this.actor, checkCalendarRead, checkCalendarRead)
    this.attendance = new AuthorizedReadService(this.repositories.attendance, this.actor, checkAttendanceRead, async (actor, ids) => {
      // Find students associated with these attendance records to check student access
      const records = await this.repositories.attendance.findByIds(ids)
      const studentIds = [...new Set(records.map(r => r.studentId))]
      await this.authorizationPolicy.checkStudentAccess(actor, studentIds)
    })

    this.announcements = new AuthorizedReadService(this.repositories.announcements, this.actor, checkCommunicationsRead, checkCommunicationsRead)
    this.announcementTargets = new AuthorizedReadService(this.repositories.announcementTargets, this.actor, checkCommunicationsRead, checkCommunicationsRead)
    this.messageDeliveries = new AuthorizedReadService(this.repositories.messageDeliveries, this.actor, checkCommunicationsRead, checkCommunicationsRead)

    this.subjects = new AuthorizedReadService(this.repositories.subjects, this.actor, checkCurriculumRead, checkCurriculumRead)
    this.subjectMatters = new AuthorizedReadService(this.repositories.subjectMatters, this.actor, checkCurriculumRead, checkCurriculumRead)
    this.classGroups = new AuthorizedReadService(this.repositories.classGroups, this.actor, checkClassDirectory, async (actor, ids) => this.authorizationPolicy.checkClassGroupAccess(actor, ids))
    this.classSubjects = new AuthorizedReadService(this.repositories.classSubjects, this.actor, checkCurriculumRead, checkCurriculumRead)
    this.classSubjectMatters = new AuthorizedReadService(this.repositories.classSubjectMatters, this.actor, checkCurriculumRead, checkCurriculumRead)
    this.classSubjectProgress = new AuthorizedReadService(this.repositories.classSubjectProgress, this.actor, checkAcademicsReadProgress, checkAcademicsReadProgress)

    this.assessments = new AuthorizedReadService(this.repositories.assessments, this.actor, checkAssessmentsReadResults, async (actor, ids) => this.authorizationPolicy.checkAssessmentAccess(actor, ids))
    this.assessmentResults = new AuthorizedReadService(this.repositories.assessmentResults, this.actor, checkAssessmentsReadResults, async (actor, ids) => {
      const records = await this.repositories.assessmentResults.findByIds(ids)
      const assessmentIds = [...new Set(records.map(r => r.assessmentId))]
      await this.authorizationPolicy.checkAssessmentAccess(actor, assessmentIds)
    })
    this.gradeScales = new AuthorizedReadService(this.repositories.gradeScales, this.actor, checkAssessmentsReadResults, checkAssessmentsReadResults)
    this.definitions = new AuthorizedReadService(this.repositories.definitions, this.actor, checkReportCardReadDetail, checkReportCardReadDetail)
    this.sections = new AuthorizedReadService(this.repositories.sections, this.actor, checkReportCardReadDetail, checkReportCardReadDetail)
    this.results = new AuthorizedReadService(this.repositories.results, this.actor, checkReportCardReadDetail, async (actor, ids) => this.authorizationPolicy.checkReportCardResultAccess(actor, ids))

    this.students = new AuthorizedReadService(this.repositories.students, this.actor, checkStudentDirectoryRead, async (actor, ids) => this.authorizationPolicy.checkStudentAccess(actor, ids))
    this.enrollments = new AuthorizedReadService(this.repositories.enrollments, this.actor, checkEnrollmentHistoryRead, async (actor, ids) => {
      const records = await this.repositories.enrollments.findByIds(ids)
      const studentIds = [...new Set(records.map(r => r.studentId))]
      await this.authorizationPolicy.checkStudentAccess(actor, studentIds)
    })
    this.guardians = new AuthorizedReadService(this.repositories.guardians, this.actor, checkGuardianAdminRead, async (actor, ids) => this.authorizationPolicy.checkGuardianAccess(actor, ids))
    this.guardianLinks = new AuthorizedReadService(this.repositories.guardianLinks, this.actor, checkGuardianAdminRead, async (actor, ids) => {
      const links = await this.repositories.guardianLinks.findByIds(ids)
      const studentIds = [...new Set(links.map(l => l.studentId))]
      await this.authorizationPolicy.checkStudentAccess(actor, studentIds)
    })
    this.studentNotes = new AuthorizedReadService(this.repositories.studentNotes, this.actor, checkStudentDetailRead, async (actor, ids) => this.authorizationPolicy.checkStudentNoteAccess(actor, ids))
    this.studentHealthProfiles = new AuthorizedReadService(this.repositories.studentHealthProfiles, this.actor, checkStudentDetailRead, async (actor, ids) => this.authorizationPolicy.checkStudentHealthAccess(actor, ids))
    this.studentDisciplinaryActions = new AuthorizedReadService(this.repositories.studentDisciplinaryActions, this.actor, checkBehaviorReadIncidents, checkBehaviorReadIncidents)
    this.disciplinaryActions = new AuthorizedReadService(this.repositories.disciplinaryActions, this.actor, checkBehaviorReadIncidents, checkBehaviorReadIncidents)
    this.studentIncidentInvolvements = new AuthorizedReadService(this.repositories.studentIncidentInvolvements, this.actor, checkBehaviorReadIncidents, checkBehaviorReadIncidents)
    this.incidents = new AuthorizedReadService(this.repositories.incidents, this.actor, checkBehaviorReadIncidents, checkBehaviorReadIncidents)
  }
}

export class SchoolQueryService extends BaseSchoolQueryService {
  constructor(args: ServiceArgs) {
    super(args)
  }

  async getOverdueFeeCount(schoolId: string): Promise<number> {
    await this.authorizationPolicy.checkGlobalAction(this.actor, 'query.get_overdue_fees')
    return this.repositories.schools.getOverdueFeeCount(schoolId)
  }

  async getPublishedReportCardCount(schoolId: string): Promise<number> {
    await this.authorizationPolicy.checkGlobalAction(this.actor, 'queries.read_report_card_detail')
    return this.repositories.schools.getPublishedReportCardCount(schoolId)
  }
}
