import type { ActorMetadata, AuthorizationPolicy } from '../authorization'
import type {
  AcademicPeriod,
  AcademicYear,
  AccessRole,
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
  ClassLogbookEntry,
  ClassSubjectProgress,
  HomeworkAssignment,
  HomeworkSubmission,
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
  StaffRoleAssignment,
  Student,
  StudentClassEnrollment,
  StudentDisciplinaryAction,
  StudentFee,
  StudentHealthProfile,
  StudentIncidentInvolvement,
  StudentNote,
  Subject,
  SubjectMatter,
} from '../domains'
import type { AtomicExecutionPort, SchoolRepositories } from '../ports'
import type { EntityConfigFactoryInput } from '../shared'
import type { ServiceArgs } from '../shared/service-args'
import {
  academicPeriodConfig,
  academicYearConfig,
  accessRoleConfig,
  announcementConfig,
  announcementTargetConfig,
  assessmentConfig,
  assessmentResultConfig,
  attachmentConfig,
  attendanceRecordConfig,
  calendarEventConfig,
  classGroupConfig,
  classSubjectConfig,
  classSubjectMatterConfig,
  classLogbookEntryConfig,
  classSubjectProgressConfig,
  homeworkAssignmentConfig,
  homeworkSubmissionConfig,
  disciplinaryActionConfig,
  feeConfig,
  gradeLevelConfig,
  gradeScaleConfig,
  guardianConfig,
  guardianStudentLinkConfig,
  incidentConfig,
  messageDeliveryConfig,
  paymentConfig,
  periodDefinitionConfig,
  reportCardDefinitionConfig,
  reportCardDefinitionSectionConfig,
  reportCardResultConfig,
  resourceAssignmentConfig,
  resourceConfig,
  scheduleConfig,
  schoolConfig,
  sessionConfig,
  staffAssignmentConfig,
  staffMemberConfig,
  staffRoleAssignmentConfig,
  studentClassEnrollmentConfig,
  studentConfig,
  studentDisciplinaryActionConfig,
  studentFeeConfig,
  studentHealthProfileConfig,
  studentIncidentInvolvementConfig,
  studentNoteConfig,
  subjectConfig,
  subjectMatterConfig,
} from '../domains'

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
  readonly accessRoles: ManagedEntityService<AccessRole>
  readonly staffRoleAssignments: ManagedEntityService<StaffRoleAssignment>
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
  readonly classLogbookEntries: ManagedEntityService<ClassLogbookEntry>
  readonly homeworkAssignments: ManagedEntityService<HomeworkAssignment>
  readonly homeworkSubmissions: ManagedEntityService<HomeworkSubmission>

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
    this.accessRoles = new ManagedEntityService({ ...serviceArgs, config: accessRoleConfig(input) })
    this.staffRoleAssignments = new ManagedEntityService({ ...serviceArgs, config: staffRoleAssignmentConfig(input) })
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
    this.classLogbookEntries = new ManagedEntityService({ ...serviceArgs, config: classLogbookEntryConfig(input) })
    this.homeworkAssignments = new ManagedEntityService({ ...serviceArgs, config: homeworkAssignmentConfig(input) })
    this.homeworkSubmissions = new ManagedEntityService({ ...serviceArgs, config: homeworkSubmissionConfig(input) })

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
