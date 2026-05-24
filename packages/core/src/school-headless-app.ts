import type { AcademicPeriodRepository } from '$lib/core/ports/academic-period-repository'
import type { AcademicYearRepository } from '$lib/core/ports/academic-year-repository'
import type { AnnouncementRepository } from '$lib/core/ports/announcement-repository'
import type { AnnouncementTargetRepository } from '$lib/core/ports/announcement-target-repository'
import type { AssessmentRepository } from '$lib/core/ports/assessment-repository'
import type { AttendanceRepository } from '$lib/core/ports/attendance-repository'
import type { CalendarEventRepository } from '$lib/core/ports/calendar-event-repository'
import type { ClassGroupRepository } from '$lib/core/ports/class-group-repository'
import type { ClassSubjectMatterRepository } from '$lib/core/ports/class-subject-matter-repository'
import type { ClassSubjectProgressRepository } from '$lib/core/ports/class-subject-progress-repository'
import type { ClassSubjectRepository } from '$lib/core/ports/class-subject-repository'
import type { FeeRepository } from '$lib/core/ports/fee-repository'
import type { GradeRepository } from '$lib/core/ports/grade-repository'
import type { GroupedSessionRepository } from '$lib/core/ports/grouped-session-repository'
import type { GuardianRepository } from '$lib/core/ports/guardian-repository'
import type { GuardianStudentLinkRepository } from '$lib/core/ports/guardian-student-link-repository'
import type { MessageDeliveryRepository } from '$lib/core/ports/message-delivery-repository'
import type { PaymentRepository } from '$lib/core/ports/payment-repository'
import type { ReportCardDefinitionRepository } from '$lib/core/ports/report-card-definition-repository'
import type { ReportCardDefinitionSectionRepository } from '$lib/core/ports/report-card-definition-section-repository'
import type { ReportCardResultRepository } from '$lib/core/ports/report-card-result-repository'
import type { ScheduleRepository } from '$lib/core/ports/schedule-repository'
import type { SchoolRepository } from '$lib/core/ports/school-repository'
import type { SessionRepository } from '$lib/core/ports/session-repository'
import type { StaffAssignmentRepository } from '$lib/core/ports/staff-assignment-repository'
import type { StaffMemberRepository } from '$lib/core/ports/staff-member-repository'
import type { StudentClassEnrollmentRepository } from '$lib/core/ports/student-enrollment-repository'
import type { StudentFeeRepository } from '$lib/core/ports/student-fee-repository'
import type { StudentRepository } from '$lib/core/ports/student-repository'
import type { SubjectMatterRepository } from '$lib/core/ports/subject-matter-repository'
import type { SubjectRepository } from '$lib/core/ports/subject-repository'
import { AcademicsService } from '$lib/core/services/academics/academics'
import { AssessmentService } from '$lib/core/services/assessment/assessment'
import { GradeService } from '$lib/core/services/assessment/grade'
import { ReportCardDefinitionSectionService } from '$lib/core/services/assessment/report-card-definition-section'
import { ReportCardResultService } from '$lib/core/services/assessment/report-card-result'
import { FinanceService } from '$lib/core/services/fees/finance'
import { GuardianService } from '$lib/core/services/guardian'
import { CommunicationsService } from '$lib/core/services/messaging/communications'
import { AttendanceService } from '$lib/core/services/planing/attendance'
import { AttendanceReviewService } from '$lib/core/services/planing/attendance-review'
import { ScheduleService } from '$lib/core/services/planing/schedule'
import { SessionService } from '$lib/core/services/planing/session'
import { AcademicCalendarService } from '$lib/core/services/workspace/academic-calendar'
import { ClassGroupService } from '$lib/core/services/workspace/class-group'
import { ClassGroupReadService } from '$lib/core/services/workspace/class-group-read'
import { SchoolService } from '$lib/core/services/workspace/school'
import { SchoolOverviewService } from '$lib/core/services/workspace/school-overview'
import { StaffService } from '$lib/core/services/workspace/staff'
import { StaffAssignmentService } from '$lib/core/services/workspace/staff-assignment'
import { StudentService } from '$lib/core/services/workspace/student'
import { StudentDirectoryService } from '$lib/core/services/workspace/student-directory'
import { SubjectCatalogService } from '$lib/core/services/workspace/subject-catalog'
import { WorkspaceService } from '$lib/core/services/workspace/workspace'

export interface SchoolHeadlessAppArgs {
  schoolRepository: SchoolRepository
  classGroupRepository: ClassGroupRepository
  studentRepository: StudentRepository
  StudentClassEnrollmentRepository: StudentClassEnrollmentRepository
  guardianRepository: GuardianRepository
  guardianStudentLinkRepository: GuardianStudentLinkRepository
  staffMemberRepository: StaffMemberRepository
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
  assessmentRepository: AssessmentRepository
  attendanceRepository: AttendanceRepository
  gradeRepository: GradeRepository
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

export class SchoolHeadlessApp {
  readonly school: SchoolService
  readonly academicCalendar: AcademicCalendarService
  readonly classGroups: ClassGroupService
  readonly students: StudentService
  readonly guardians: GuardianService
  readonly staff: StaffService
  readonly staffAssignments: StaffAssignmentService
  readonly subjectCatalog: SubjectCatalogService
  readonly academics: AcademicsService
  readonly reportCardDefinitionSections: ReportCardDefinitionSectionService
  readonly sessions: SessionService
  readonly assessments: AssessmentService
  readonly attendance: AttendanceService
  readonly grades: GradeService
  readonly reportCardResults: ReportCardResultService
  readonly communications: CommunicationsService
  readonly finance: FinanceService
  readonly schedules: ScheduleService
  readonly workspace: WorkspaceService
  readonly schoolOverview: SchoolOverviewService
  readonly studentDirectory: StudentDirectoryService
  readonly classGroupRead: ClassGroupReadService
  readonly attendanceReview: AttendanceReviewService

  constructor(args: SchoolHeadlessAppArgs) {
    this.school = new SchoolService({
      schoolRepository: args.schoolRepository,
    })
    this.academicCalendar = new AcademicCalendarService({
      schoolRepository: args.schoolRepository,
      academicYearRepository: args.academicYearRepository,
      academicPeriodRepository: args.academicPeriodRepository,
    })
    this.classGroups = new ClassGroupService({
      schoolRepository: args.schoolRepository,
      academicYearRepository: args.academicYearRepository,
      classGroupRepository: args.classGroupRepository,
    })
    this.students = new StudentService({
      schoolRepository: args.schoolRepository,
      classGroupRepository: args.classGroupRepository,
      studentRepository: args.studentRepository,
      StudentClassEnrollmentRepository: args.StudentClassEnrollmentRepository,
    })
    this.guardians = new GuardianService({
      schoolRepository: args.schoolRepository,
      classGroupRepository: args.classGroupRepository,
      studentRepository: args.studentRepository,
      StudentClassEnrollmentRepository: args.StudentClassEnrollmentRepository,
      guardianRepository: args.guardianRepository,
      guardianStudentLinkRepository: args.guardianStudentLinkRepository,
    })
    this.staff = new StaffService({
      schoolRepository: args.schoolRepository,
      staffMemberRepository: args.staffMemberRepository,
    })
    this.staffAssignments = new StaffAssignmentService({
      staffMemberRepository: args.staffMemberRepository,
      classGroupRepository: args.classGroupRepository,
      classSubjectRepository: args.classSubjectRepository,
      groupedSessionRepository: args.groupedSessionRepository,
      sessionRepository: args.sessionRepository,
      staffAssignmentRepository: args.staffAssignmentRepository,
    })
    this.subjectCatalog = new SubjectCatalogService({
      schoolRepository: args.schoolRepository,
      subjectRepository: args.subjectRepository,
    })
    this.academics = new AcademicsService({
      subjectRepository: args.subjectRepository,
      subjectMatterRepository: args.subjectMatterRepository,
      classSubjectRepository: args.classSubjectRepository,
      classSubjectMatterRepository: args.classSubjectMatterRepository,
      classSubjectProgressRepository: args.classSubjectProgressRepository,
      sessionRepository: args.sessionRepository,
    })
    this.reportCardDefinitionSections = new ReportCardDefinitionSectionService({
      reportCardDefinitionRepository: args.reportCardDefinitionRepository,
      reportCardDefinitionSectionRepository: args.reportCardDefinitionSectionRepository,
    })
    this.sessions = new SessionService({
      classGroupRepository: args.classGroupRepository,
      sessionRepository: args.sessionRepository,
    })
    this.assessments = new AssessmentService({
      classGroupRepository: args.classGroupRepository,
      academicPeriodRepository: args.academicPeriodRepository,
      sessionRepository: args.sessionRepository,
      assessmentRepository: args.assessmentRepository,
    })
    const attendance = new AttendanceService({
      studentRepository: args.studentRepository,
      StudentClassEnrollmentRepository: args.StudentClassEnrollmentRepository,
      sessionRepository: args.sessionRepository,
      attendanceRepository: args.attendanceRepository,
    })
    const grades = new GradeService({
      studentRepository: args.studentRepository,
      StudentClassEnrollmentRepository: args.StudentClassEnrollmentRepository,
      assessmentRepository: args.assessmentRepository,
      classSubjectRepository: args.classSubjectRepository,
      academicPeriodRepository: args.academicPeriodRepository,
      gradeRepository: args.gradeRepository,
      classGroupRepository: args.classGroupRepository,
      reportCardDefinitionSectionRepository: args.reportCardDefinitionSectionRepository,
    })

    this.attendance = attendance
    this.grades = grades
    this.reportCardResults = new ReportCardResultService({
      studentRepository: args.studentRepository,
      classGroupRepository: args.classGroupRepository,
      StudentClassEnrollmentRepository: args.StudentClassEnrollmentRepository,
      academicPeriodRepository: args.academicPeriodRepository,
      assessmentRepository: args.assessmentRepository,
      gradeRepository: args.gradeRepository,
      reportCardDefinitionRepository: args.reportCardDefinitionRepository,
      reportCardResultRepository: args.reportCardResultRepository,
      attendanceService: attendance,
      gradeService: grades,
    })
    this.communications = new CommunicationsService({
      classGroupRepository: args.classGroupRepository,
      announcementRepository: args.announcementRepository,
      announcementTargetRepository: args.announcementTargetRepository,
      messageDeliveryRepository: args.messageDeliveryRepository,
    })
    this.finance = new FinanceService({
      studentRepository: args.studentRepository,
      feeRepository: args.feeRepository,
      studentFeeRepository: args.studentFeeRepository,
      paymentRepository: args.paymentRepository,
    })
    this.schedules = new ScheduleService({
      classGroupRepository: args.classGroupRepository,
      scheduleRepository: args.scheduleRepository,
      calendarEventRepository: args.calendarEventRepository,
      sessionRepository: args.sessionRepository,
    })
    this.workspace = new WorkspaceService({
      schoolRepository: args.schoolRepository,
      academicYearRepository: args.academicYearRepository,
      academicPeriodRepository: args.academicPeriodRepository,
      classGroupRepository: args.classGroupRepository,
      staffMemberRepository: args.staffMemberRepository,
      classSubjectRepository: args.classSubjectRepository,
      staffAssignmentRepository: args.staffAssignmentRepository,
    })
    this.schoolOverview = new SchoolOverviewService({
      schoolRepository: args.schoolRepository,
      academicYearRepository: args.academicYearRepository,
      classGroupRepository: args.classGroupRepository,
      studentRepository: args.studentRepository,
      announcementRepository: args.announcementRepository,
      studentFeeRepository: args.studentFeeRepository,
      reportCardResultRepository: args.reportCardResultRepository,
    })
    this.studentDirectory = new StudentDirectoryService({
      schoolRepository: args.schoolRepository,
      academicYearRepository: args.academicYearRepository,
      classGroupRepository: args.classGroupRepository,
      studentRepository: args.studentRepository,
      StudentClassEnrollmentRepository: args.StudentClassEnrollmentRepository,
      guardianStudentLinkRepository: args.guardianStudentLinkRepository,
      reportCardResultRepository: args.reportCardResultRepository,
      studentFeeRepository: args.studentFeeRepository,
    })
    this.classGroupRead = new ClassGroupReadService({
      academicYearRepository: args.academicYearRepository,
      classGroupRepository: args.classGroupRepository,
      StudentClassEnrollmentRepository: args.StudentClassEnrollmentRepository,
      classSubjectRepository: args.classSubjectRepository,
      staffAssignmentRepository: args.staffAssignmentRepository,
      staffMemberRepository: args.staffMemberRepository,
      subjectRepository: args.subjectRepository,
      sessionRepository: args.sessionRepository,
    })
    this.attendanceReview = new AttendanceReviewService({
      academicYearRepository: args.academicYearRepository,
      classGroupRepository: args.classGroupRepository,
      sessionRepository: args.sessionRepository,
      attendanceRepository: args.attendanceRepository,
      StudentClassEnrollmentRepository: args.StudentClassEnrollmentRepository,
      studentRepository: args.studentRepository,
    })
  }
}
