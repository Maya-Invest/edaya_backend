import type { AcademicPeriodRepository } from './ports/academic-period-repository'
import type { AcademicYearRepository } from './ports/academic-year-repository'
import type { AnnouncementRepository } from './ports/announcement-repository'
import type { AnnouncementTargetRepository } from './ports/announcement-target-repository'
import type { AssessmentRepository } from './ports/assessment-repository'
import type { AtomicExecutionPort } from './ports/atomic-execution'
import type { AttendanceRepository } from './ports/attendance-repository'
import type { CalendarEventRepository } from './ports/calendar-event-repository'
import type { ClassGroupRepository } from './ports/class-group-repository'
import type { ClassSubjectMatterRepository } from './ports/class-subject-matter-repository'
import type { ClassSubjectProgressRepository } from './ports/class-subject-progress-repository'
import type { ClassSubjectRepository } from './ports/class-subject-repository'
import type { FeeRepository } from './ports/fee-repository'
import type { GradeLevelRepository } from './ports/grade-level-repository'
import type { GradeRepository } from './ports/grade-repository'
import type { GradeScaleRepository } from './ports/grade-scale-repository'
import type { GroupedSessionRepository } from './ports/grouped-session-repository'
import type { GuardianRepository } from './ports/guardian-repository'
import type { GuardianStudentLinkRepository } from './ports/guardian-student-link-repository'
import type { MessageDeliveryRepository } from './ports/message-delivery-repository'
import type { PaymentRepository } from './ports/payment-repository'
import type { PeriodDefinitionRepository } from './ports/period-definition-repository'
import type { ReportCardDefinitionRepository } from './ports/report-card-definition-repository'
import type { ReportCardDefinitionSectionRepository } from './ports/report-card-definition-section-repository'
import type { ReportCardResultRepository } from './ports/report-card-result-repository'
import type { ScheduleRepository } from './ports/schedule-repository'
import type { SchoolRepository } from './ports/school-repository'
import type { SessionRepository } from './ports/session-repository'
import type { StaffAssignmentRepository } from './ports/staff-assignment-repository'
import type { StaffMemberRepository } from './ports/staff-member-repository'
import type { StudentClassEnrollmentRepository } from './ports/student-enrollment-repository'
import type { StudentFeeRepository } from './ports/student-fee-repository'
import type { StudentRepository } from './ports/student-repository'
import type { SubjectMatterRepository } from './ports/subject-matter-repository'
import type { SubjectRepository } from './ports/subject-repository'
import type { ActorMetadata, AuthorizationPolicy } from './services/authorization'
import { AcademicsService } from './services/academics'
import { AssessmentsService } from './services/assessments'
import { CommunicationsService } from './services/communications'
import { FinanceService } from './services/finance'
import { SchoolQueryService } from './services/queries'
import { SchedulingService } from './services/scheduling'
import { SetupService } from './services/setup'
import { StudentsService } from './services/students'

export interface SchoolHeadlessAppDependencies {
  atomicExecution: AtomicExecutionPort
  schoolRepository: SchoolRepository
  classGroupRepository: ClassGroupRepository
  studentRepository: StudentRepository
  StudentClassEnrollmentRepository: StudentClassEnrollmentRepository
  guardianRepository: GuardianRepository
  guardianStudentLinkRepository: GuardianStudentLinkRepository
  staffMemberRepository: StaffMemberRepository
  gradeLevelRepository: GradeLevelRepository
  classSubjectRepository: ClassSubjectRepository
  classSubjectMatterRepository: ClassSubjectMatterRepository
  classSubjectProgressRepository: ClassSubjectProgressRepository
  staffAssignmentRepository: StaffAssignmentRepository
  academicYearRepository: AcademicYearRepository
  academicPeriodRepository: AcademicPeriodRepository
  subjectRepository: SubjectRepository
  subjectMatterRepository: SubjectMatterRepository
  sessionRepository: SessionRepository
  groupedSessionRepository: GroupedSessionRepository
  periodDefinitionRepository: PeriodDefinitionRepository
  assessmentRepository: AssessmentRepository
  attendanceRepository: AttendanceRepository
  gradeRepository: GradeRepository
  gradeScaleRepository: GradeScaleRepository
  reportCardDefinitionRepository: ReportCardDefinitionRepository
  reportCardResultRepository: ReportCardResultRepository
  announcementRepository: AnnouncementRepository
  announcementTargetRepository: AnnouncementTargetRepository
  messageDeliveryRepository: MessageDeliveryRepository
  feeRepository: FeeRepository
  studentFeeRepository: StudentFeeRepository
  paymentRepository: PaymentRepository
  reportCardDefinitionSectionRepository: ReportCardDefinitionSectionRepository
  scheduleRepository: ScheduleRepository
  calendarEventRepository: CalendarEventRepository
}

export interface SchoolHeadlessAppArgs extends SchoolHeadlessAppDependencies {
  actor: ActorMetadata
  authorizationPolicy: AuthorizationPolicy
}

export interface SchoolApplicationArgs extends SchoolHeadlessAppDependencies {
  authorizationPolicy: AuthorizationPolicy
}

export class SchoolApplication {
  private readonly args: SchoolApplicationArgs

  constructor(args: SchoolApplicationArgs) {
    this.args = args
  }

  forActor(actor: ActorMetadata): SchoolHeadlessApp {
    return new SchoolHeadlessApp({ ...this.args, actor })
  }
}

export class SchoolHeadlessApp {
  readonly setup: SetupService
  readonly academics: AcademicsService
  readonly scheduling: SchedulingService
  readonly assessments: AssessmentsService
  readonly students: StudentsService
  readonly finance: FinanceService
  readonly communications: CommunicationsService
  readonly queries: SchoolQueryService

  constructor(args: SchoolHeadlessAppArgs) {
    this.setup = new SetupService(args)
    this.academics = new AcademicsService({
      actor: args.actor,
      authorizationPolicy: args.authorizationPolicy,
      atomicExecution: args.atomicExecution,
      schoolRepository: args.schoolRepository,
      classGroupRepository: args.classGroupRepository,
      subjectRepository: args.subjectRepository,
      subjectMatterRepository: args.subjectMatterRepository,
      classSubjectRepository: args.classSubjectRepository,
      classSubjectMatterRepository: args.classSubjectMatterRepository,
      classSubjectProgressRepository: args.classSubjectProgressRepository,
      sessionRepository: args.sessionRepository,
    })
    this.scheduling = new SchedulingService(args)
    this.assessments = new AssessmentsService({
      actor: args.actor,
      authorizationPolicy: args.authorizationPolicy,
      atomicExecution: args.atomicExecution,
      schoolRepository: args.schoolRepository,
      academicYearRepository: args.academicYearRepository,
      gradeLevelRepository: args.gradeLevelRepository,
      studentRepository: args.studentRepository,
      StudentClassEnrollmentRepository: args.StudentClassEnrollmentRepository,
      assessmentRepository: args.assessmentRepository,
      classSubjectRepository: args.classSubjectRepository,
      academicPeriodRepository: args.academicPeriodRepository,
      gradeRepository: args.gradeRepository,
      gradeScaleRepository: args.gradeScaleRepository,
      classGroupRepository: args.classGroupRepository,
      sessionRepository: args.sessionRepository,
      reportCardDefinitionRepository: args.reportCardDefinitionRepository,
      reportCardDefinitionSectionRepository: args.reportCardDefinitionSectionRepository,
      reportCardResultRepository: args.reportCardResultRepository,
      attendanceService: this.scheduling,
    })
    this.students = new StudentsService({
      actor: args.actor,
      authorizationPolicy: args.authorizationPolicy,
      schoolRepository: args.schoolRepository,
      studentRepository: args.studentRepository,
      classGroupRepository: args.classGroupRepository,
      StudentClassEnrollmentRepository: args.StudentClassEnrollmentRepository,
      guardianRepository: args.guardianRepository,
      guardianStudentLinkRepository: args.guardianStudentLinkRepository,
    })
    this.communications = new CommunicationsService({
      actor: args.actor,
      authorizationPolicy: args.authorizationPolicy,
      classGroupRepository: args.classGroupRepository,
      gradeLevelRepository: args.gradeLevelRepository,
      staffMemberRepository: args.staffMemberRepository,
      guardianRepository: args.guardianRepository,
      studentRepository: args.studentRepository,
      announcementRepository: args.announcementRepository,
      announcementTargetRepository: args.announcementTargetRepository,
      messageDeliveryRepository: args.messageDeliveryRepository,
    })
    this.finance = new FinanceService({
      actor: args.actor,
      authorizationPolicy: args.authorizationPolicy,
      atomicExecution: args.atomicExecution,
      studentRepository: args.studentRepository,
      feeRepository: args.feeRepository,
      studentFeeRepository: args.studentFeeRepository,
      paymentRepository: args.paymentRepository,
    })
    this.queries = new SchoolQueryService(args)
  }
}
