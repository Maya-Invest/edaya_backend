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
import type { AtomicExecutionPort, SchoolRepositories } from '../../ports'
import type { ActorMetadata, AuthorizationPolicy } from '../authorization'
import type { ServiceArgs } from '../shared/service-args'
import { createSchoolEntityServiceConfigs } from './entity-service-config'
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

    const configs = createSchoolEntityServiceConfigs(args)
    const serviceArgs = {
      actor: args.actor,
      repositories: args.repositories,
    }

    this.schools = new ManagedEntityService({ ...serviceArgs, config: configs.schools })
    this.academicYears = new ManagedEntityService({ ...serviceArgs, config: configs.academicYears })
    this.academicPeriods = new ManagedEntityService({ ...serviceArgs, config: configs.academicPeriods })
    this.periodDefinitions = new ManagedEntityService({ ...serviceArgs, config: configs.periodDefinitions })
    this.gradeLevels = new ManagedEntityService({ ...serviceArgs, config: configs.gradeLevels })
    this.staffMembers = new ManagedEntityService({ ...serviceArgs, config: configs.staffMembers })
    this.staffAssignments = new ManagedEntityService({ ...serviceArgs, config: configs.staffAssignments })
    this.attachments = new ManagedEntityService({ ...serviceArgs, config: configs.attachments })
    this.resources = new ManagedEntityService({ ...serviceArgs, config: configs.resources })
    this.resourceAssignments = new ManagedEntityService({ ...serviceArgs, config: configs.resourceAssignments })

    this.fees = new ManagedEntityService({ ...serviceArgs, config: configs.fees })
    this.studentFees = new ManagedEntityService({ ...serviceArgs, config: configs.studentFees })
    this.payments = new ManagedEntityService({ ...serviceArgs, config: configs.payments })

    this.schedules = new ManagedEntityService({ ...serviceArgs, config: configs.schedules })
    this.sessions = new ManagedEntityService({ ...serviceArgs, config: configs.sessions })
    this.calendarEvents = new ManagedEntityService({ ...serviceArgs, config: configs.calendarEvents })
    this.attendance = new ManagedEntityService({ ...serviceArgs, config: configs.attendance })

    this.announcements = new ManagedEntityService({ ...serviceArgs, config: configs.announcements })
    this.announcementTargets = new ManagedEntityService({ ...serviceArgs, config: configs.announcementTargets })
    this.messageDeliveries = new ManagedEntityService({ ...serviceArgs, config: configs.messageDeliveries })

    this.subjects = new ManagedEntityService({ ...serviceArgs, config: configs.subjects })
    this.subjectMatters = new ManagedEntityService({ ...serviceArgs, config: configs.subjectMatters })
    this.classGroups = new ManagedEntityService({ ...serviceArgs, config: configs.classGroups })
    this.classSubjects = new ManagedEntityService({ ...serviceArgs, config: configs.classSubjects })
    this.classSubjectMatters = new ManagedEntityService({ ...serviceArgs, config: configs.classSubjectMatters })
    this.classSubjectProgress = new ManagedEntityService({ ...serviceArgs, config: configs.classSubjectProgress })

    this.assessments = new ManagedEntityService({ ...serviceArgs, config: configs.assessments })
    this.assessmentResults = new ManagedEntityService({ ...serviceArgs, config: configs.assessmentResults })
    this.gradeScales = new ManagedEntityService({ ...serviceArgs, config: configs.gradeScales })
    this.definitions = new ManagedEntityService({ ...serviceArgs, config: configs.definitions })
    this.sections = new ManagedEntityService({ ...serviceArgs, config: configs.sections })
    this.results = new ManagedEntityService({ ...serviceArgs, config: configs.results })

    this.students = new ManagedEntityService({ ...serviceArgs, config: configs.students })
    this.enrollments = new ManagedEntityService({ ...serviceArgs, config: configs.enrollments })
    this.guardians = new ManagedEntityService({ ...serviceArgs, config: configs.guardians })
    this.guardianLinks = new ManagedEntityService({ ...serviceArgs, config: configs.guardianLinks })
    this.studentNotes = new ManagedEntityService({ ...serviceArgs, config: configs.studentNotes })
    this.studentHealthProfiles = new ManagedEntityService({ ...serviceArgs, config: configs.studentHealthProfiles })
    this.studentDisciplinaryActions = new ManagedEntityService({ ...serviceArgs, config: configs.studentDisciplinaryActions })
    this.disciplinaryActions = new ManagedEntityService({ ...serviceArgs, config: configs.disciplinaryActions })
    this.studentIncidentInvolvements = new ManagedEntityService({ ...serviceArgs, config: configs.studentIncidentInvolvements })
    this.incidents = new ManagedEntityService({ ...serviceArgs, config: configs.incidents })
  }
}
