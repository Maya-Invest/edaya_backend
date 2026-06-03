import type { ActorMetadata, AuthorizationPolicy } from '../authorization'
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
} from '../entities'
import type { AtomicExecutionPort, SchoolRepositories } from '../ports'
import type { EntityConfigFactoryInput } from '../shared'
import type { ServiceArgs } from '../shared/service-args'
import { classSubjectConfig } from './entity-configs/academics/class-subject'
import { classSubjectMatterConfig } from './entity-configs/academics/class-subject-matter'
import { classSubjectProgressConfig } from './entity-configs/academics/class-subject-progress'
import { subjectConfig } from './entity-configs/academics/subject'
import { subjectMatterConfig } from './entity-configs/academics/subject-matter'
import { assessmentConfig } from './entity-configs/assessments/assessment'
import { assessmentResultConfig } from './entity-configs/assessments/assessment-result'
import { reportCardDefinitionConfig } from './entity-configs/assessments/report-card-definition'
import { reportCardDefinitionSectionConfig } from './entity-configs/assessments/report-card-definition-section'
import { reportCardResultConfig } from './entity-configs/assessments/report-card-result'
import { feeConfig } from './entity-configs/finances/fee'
import { paymentConfig } from './entity-configs/finances/payment'
import { studentFeeConfig } from './entity-configs/finances/student-fee'
import { announcementConfig } from './entity-configs/messaging/announcement'
import { announcementTargetConfig } from './entity-configs/messaging/announcement-target'
import { messageDeliveryConfig } from './entity-configs/messaging/message-delivery'
import { attendanceRecordConfig } from './entity-configs/scheduling/attendance-record'
import { calendarEventConfig } from './entity-configs/scheduling/calendar-event'
import { periodDefinitionConfig } from './entity-configs/scheduling/period-definition'
import { scheduleConfig } from './entity-configs/scheduling/schedule'
import { sessionConfig } from './entity-configs/scheduling/session'
import { academicPeriodConfig } from './entity-configs/school/academic-period'
import { academicYearConfig } from './entity-configs/school/academic-year'
import { attachmentConfig } from './entity-configs/school/attachment'
import { classGroupConfig } from './entity-configs/school/class-group'
import { gradeLevelConfig } from './entity-configs/school/grade-level'
import { gradeScaleConfig } from './entity-configs/school/grade-scale'
import { resourceConfig } from './entity-configs/school/resource'
import { resourceAssignmentConfig } from './entity-configs/school/resource-assignment'
import { schoolConfig } from './entity-configs/school/school'
import { staffAssignmentConfig } from './entity-configs/school/staff-assignment'
import { staffMemberConfig } from './entity-configs/school/staff-member'
import { disciplinaryActionConfig } from './entity-configs/students/disciplinary-action'
import { guardianConfig } from './entity-configs/students/guardian'
import { guardianStudentLinkConfig } from './entity-configs/students/guardian-student-link'
import { incidentConfig } from './entity-configs/students/incident'
import { studentConfig } from './entity-configs/students/student'
import { studentClassEnrollmentConfig } from './entity-configs/students/student-class-enrollment'
import { studentDisciplinaryActionConfig } from './entity-configs/students/student-disciplinary-action'
import { studentHealthProfileConfig } from './entity-configs/students/student-health-profile'
import { studentIncidentInvolvementConfig } from './entity-configs/students/student-incident-involvement'
import { studentNoteConfig } from './entity-configs/students/student-note'
import { ManagedEntityService } from './managed-entity-service'

export class BaseSchoolService {
  readonly actor: ActorMetadata
  readonly repositories: SchoolRepositories
  readonly authorizationPolicy: AuthorizationPolicy
  readonly atomicExecution: AtomicExecutionPort

  readonly schools: ManagedEntityService<School>
  readonly academicYears: ManagedEntityService<AcademicYear>
  readonly academicPeriods: ManagedEntityService<AcademicPeriod>
  readonly periodDefinitions: ManagedEntityService<PeriodDefinition>
  readonly gradeLevels: ManagedEntityService<GradeLevel>
  readonly staffMembers: ManagedEntityService<StaffMember>
  readonly staffAssignments: ManagedEntityService<StaffAssignment>
  readonly attachments: ManagedEntityService<Attachment>
  readonly resources: ManagedEntityService<Resource>
  readonly resourceAssignments: ManagedEntityService<ResourceAssignment>

  readonly fees: ManagedEntityService<Fee>
  readonly studentFees: ManagedEntityService<StudentFee>
  readonly payments: ManagedEntityService<Payment>

  readonly schedules: ManagedEntityService<Schedule>
  readonly sessions: ManagedEntityService<Session>
  readonly calendarEvents: ManagedEntityService<CalendarEvent>
  readonly attendance: ManagedEntityService<AttendanceRecord>

  readonly announcements: ManagedEntityService<Announcement>
  readonly announcementTargets: ManagedEntityService<AnnouncementTarget>
  readonly messageDeliveries: ManagedEntityService<MessageDelivery>

  readonly subjects: ManagedEntityService<Subject>
  readonly subjectMatters: ManagedEntityService<SubjectMatter>
  readonly classGroups: ManagedEntityService<ClassGroup>
  readonly classSubjects: ManagedEntityService<ClassSubject>
  readonly classSubjectMatters: ManagedEntityService<ClassSubjectMatter>
  readonly classSubjectProgress: ManagedEntityService<ClassSubjectProgress>

  readonly assessments: ManagedEntityService<Assessment>
  readonly assessmentResults: ManagedEntityService<AssessmentResult>
  readonly gradeScales: ManagedEntityService<GradeScale>
  readonly definitions: ManagedEntityService<ReportCardDefinition>
  readonly sections: ManagedEntityService<ReportCardDefinitionSection>
  readonly results: ManagedEntityService<ReportCardResult>

  readonly students: ManagedEntityService<Student>
  readonly enrollments: ManagedEntityService<StudentClassEnrollment>
  readonly guardians: ManagedEntityService<Guardian>
  readonly guardianLinks: ManagedEntityService<GuardianStudentLink>
  readonly studentNotes: ManagedEntityService<StudentNote>
  readonly studentHealthProfiles: ManagedEntityService<StudentHealthProfile>
  readonly studentDisciplinaryActions: ManagedEntityService<StudentDisciplinaryAction>
  readonly disciplinaryActions: ManagedEntityService<DisciplinaryAction>
  readonly studentIncidentInvolvements: ManagedEntityService<StudentIncidentInvolvement>
  readonly incidents: ManagedEntityService<Incident>

  constructor(args: ServiceArgs) {
    this.actor = args.actor
    this.repositories = args.repositories
    this.authorizationPolicy = args.authorizationPolicy
    this.atomicExecution = args.atomicExecution

    const serviceArgs = {
      actor: args.actor,
      repositories: args.repositories,
    }

    const input: EntityConfigFactoryInput = {
      policy: args.authorizationPolicy,
      atomicExecution: args.atomicExecution,
      repositories: args.repositories,
    }

    this.schools = new ManagedEntityService({ ...serviceArgs, config: schoolConfig(input) })
    this.academicYears = new ManagedEntityService({ ...serviceArgs, config: academicYearConfig(input) })
    this.academicPeriods = new ManagedEntityService({ ...serviceArgs, config: academicPeriodConfig(input) })
    this.periodDefinitions = new ManagedEntityService({ ...serviceArgs, config: periodDefinitionConfig(input) })
    this.gradeLevels = new ManagedEntityService({ ...serviceArgs, config: gradeLevelConfig(input) })
    this.staffMembers = new ManagedEntityService({ ...serviceArgs, config: staffMemberConfig(input) })
    this.staffAssignments = new ManagedEntityService({ ...serviceArgs, config: staffAssignmentConfig(input) })
    this.attachments = new ManagedEntityService({ ...serviceArgs, config: attachmentConfig(input) })
    this.resources = new ManagedEntityService({ ...serviceArgs, config: resourceConfig(input) })
    this.resourceAssignments = new ManagedEntityService({ ...serviceArgs, config: resourceAssignmentConfig(input) })

    this.fees = new ManagedEntityService({ ...serviceArgs, config: feeConfig(input) })
    this.studentFees = new ManagedEntityService({ ...serviceArgs, config: studentFeeConfig(input) })
    this.payments = new ManagedEntityService({ ...serviceArgs, config: paymentConfig(input) })

    this.schedules = new ManagedEntityService({ ...serviceArgs, config: scheduleConfig(input) })
    this.sessions = new ManagedEntityService({ ...serviceArgs, config: sessionConfig(input) })
    this.calendarEvents = new ManagedEntityService({ ...serviceArgs, config: calendarEventConfig(input) })
    this.attendance = new ManagedEntityService({ ...serviceArgs, config: attendanceRecordConfig(input) })

    this.announcements = new ManagedEntityService({ ...serviceArgs, config: announcementConfig(input) })
    this.announcementTargets = new ManagedEntityService({ ...serviceArgs, config: announcementTargetConfig(input) })
    this.messageDeliveries = new ManagedEntityService({ ...serviceArgs, config: messageDeliveryConfig(input) })

    this.subjects = new ManagedEntityService({ ...serviceArgs, config: subjectConfig(input) })
    this.subjectMatters = new ManagedEntityService({ ...serviceArgs, config: subjectMatterConfig(input) })
    this.classGroups = new ManagedEntityService({ ...serviceArgs, config: classGroupConfig(input) })
    this.classSubjects = new ManagedEntityService({ ...serviceArgs, config: classSubjectConfig(input) })
    this.classSubjectMatters = new ManagedEntityService({ ...serviceArgs, config: classSubjectMatterConfig(input) })
    this.classSubjectProgress = new ManagedEntityService({ ...serviceArgs, config: classSubjectProgressConfig(input) })

    this.assessments = new ManagedEntityService({ ...serviceArgs, config: assessmentConfig(input) })
    this.assessmentResults = new ManagedEntityService({ ...serviceArgs, config: assessmentResultConfig(input) })
    this.gradeScales = new ManagedEntityService({ ...serviceArgs, config: gradeScaleConfig(input) })
    this.definitions = new ManagedEntityService({ ...serviceArgs, config: reportCardDefinitionConfig(input) })
    this.sections = new ManagedEntityService({ ...serviceArgs, config: reportCardDefinitionSectionConfig(input) })
    this.results = new ManagedEntityService({ ...serviceArgs, config: reportCardResultConfig(input) })

    this.students = new ManagedEntityService({ ...serviceArgs, config: studentConfig(input) })
    this.enrollments = new ManagedEntityService({ ...serviceArgs, config: studentClassEnrollmentConfig(input) })
    this.guardians = new ManagedEntityService({ ...serviceArgs, config: guardianConfig(input) })
    this.guardianLinks = new ManagedEntityService({ ...serviceArgs, config: guardianStudentLinkConfig(input) })
    this.studentNotes = new ManagedEntityService({ ...serviceArgs, config: studentNoteConfig(input) })
    this.studentHealthProfiles = new ManagedEntityService({ ...serviceArgs, config: studentHealthProfileConfig(input) })
    this.studentDisciplinaryActions = new ManagedEntityService({ ...serviceArgs, config: studentDisciplinaryActionConfig(input) })
    this.disciplinaryActions = new ManagedEntityService({ ...serviceArgs, config: disciplinaryActionConfig(input) })
    this.studentIncidentInvolvements = new ManagedEntityService({ ...serviceArgs, config: studentIncidentInvolvementConfig(input) })
    this.incidents = new ManagedEntityService({ ...serviceArgs, config: incidentConfig(input) })
  }
}
