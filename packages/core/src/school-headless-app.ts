import type { AcademicPeriodRepository } from '$lib/core/ports/academic-period-repository'
import type { AcademicYearRepository } from '$lib/core/ports/academic-year-repository'
import type { AnnouncementRepository } from '$lib/core/ports/announcement-repository'
import type { AssessmentRepository } from '$lib/core/ports/assessment-repository'
import type { AttendanceRepository } from '$lib/core/ports/attendance-repository'
import type { ClassStaffAssignmentRepository } from '$lib/core/ports/class-staff-assignment-repository'
import type { ClassroomRepository } from '$lib/core/ports/classroom-repository'
import type { DeadlineRecordRepository } from '$lib/core/ports/deadline-record-repository'
import type { DeadlineRepository } from '$lib/core/ports/deadline-repository'
import type { GradeRepository } from '$lib/core/ports/grade-repository'
import type { GuardianRepository } from '$lib/core/ports/guardian-repository'
import type { GuardianStudentLinkRepository } from '$lib/core/ports/guardian-student-link-repository'
import type { ModuleRepository } from '$lib/core/ports/module-repository'
import type { ModuleStaffAssignmentRepository } from '$lib/core/ports/module-staff-assignment-repository'
import type { ReportCardRepository } from '$lib/core/ports/report-card-repository'
import type { SchoolFeeRepository } from '$lib/core/ports/school-fee-repository'
import type { SchoolRepository } from '$lib/core/ports/school-repository'
import type { SessionRepository } from '$lib/core/ports/session-repository'
import type { StaffMemberRepository } from '$lib/core/ports/staff-member-repository'
import type { StudentEnrollmentRepository } from '$lib/core/ports/student-enrollment-repository'
import type { StudentRepository } from '$lib/core/ports/student-repository'
import type { SubjectRepository } from '$lib/core/ports/subject-repository'
import { AnnouncementService } from '$lib/core/services/announcement'
import { AssessmentService } from '$lib/core/services/assessment/assessment'
import { GradeService } from '$lib/core/services/assessment/grade'
import { ModuleService } from '$lib/core/services/assessment/module'
import { ReportCardService } from '$lib/core/services/assessment/report-card'
import { FeeService } from '$lib/core/services/fees/fee'
import { GuardianService } from '$lib/core/services/guardian'
import { AttendanceService } from '$lib/core/services/planing/attendance'
import { AttendanceReviewService } from '$lib/core/services/planing/attendance-review'
import { DeadlineService } from '$lib/core/services/planing/deadline'
import { SessionService } from '$lib/core/services/planing/session'
import { AcademicCalendarService } from '$lib/core/services/workspace/academic-calendar'
import { ClassroomService } from '$lib/core/services/workspace/classroom'
import { ClassroomReadService } from '$lib/core/services/workspace/classroom-read'
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
  classroomRepository: ClassroomRepository
  studentRepository: StudentRepository
  studentEnrollmentRepository: StudentEnrollmentRepository
  guardianRepository: GuardianRepository
  guardianStudentLinkRepository: GuardianStudentLinkRepository
  staffMemberRepository: StaffMemberRepository
  classStaffAssignmentRepository: ClassStaffAssignmentRepository
  moduleStaffAssignmentRepository: ModuleStaffAssignmentRepository
  academicYearRepository: AcademicYearRepository
  academicPeriodRepository: AcademicPeriodRepository
  subjectRepository: SubjectRepository
  sessionRepository: SessionRepository
  assessmentRepository: AssessmentRepository
  attendanceRepository: AttendanceRepository
  gradeRepository: GradeRepository
  reportCardRepository: ReportCardRepository
  announcementRepository: AnnouncementRepository
  schoolFeeRepository: SchoolFeeRepository
  moduleRepository: ModuleRepository
  deadlineRepository: DeadlineRepository
  deadlineRecordRepository: DeadlineRecordRepository
}

export class SchoolHeadlessApp {
  readonly school: SchoolService
  readonly academicCalendar: AcademicCalendarService
  readonly classrooms: ClassroomService
  readonly students: StudentService
  readonly guardians: GuardianService
  readonly staff: StaffService
  readonly staffAssignments: StaffAssignmentService
  readonly subjectCatalog: SubjectCatalogService
  readonly modules: ModuleService
  readonly sessions: SessionService
  readonly assessments: AssessmentService
  readonly attendance: AttendanceService
  readonly grades: GradeService
  readonly reportCards: ReportCardService
  readonly announcements: AnnouncementService
  readonly fees: FeeService
  readonly deadlines: DeadlineService
  readonly workspace: WorkspaceService
  readonly schoolOverview: SchoolOverviewService
  readonly studentDirectory: StudentDirectoryService
  readonly classroomRead: ClassroomReadService
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
    this.classrooms = new ClassroomService({
      schoolRepository: args.schoolRepository,
      academicYearRepository: args.academicYearRepository,
      classroomRepository: args.classroomRepository,
    })
    this.students = new StudentService({
      schoolRepository: args.schoolRepository,
      classroomRepository: args.classroomRepository,
      studentRepository: args.studentRepository,
      studentEnrollmentRepository: args.studentEnrollmentRepository,
    })
    this.guardians = new GuardianService({
      schoolRepository: args.schoolRepository,
      classroomRepository: args.classroomRepository,
      studentRepository: args.studentRepository,
      studentEnrollmentRepository: args.studentEnrollmentRepository,
      guardianRepository: args.guardianRepository,
      guardianStudentLinkRepository: args.guardianStudentLinkRepository,
    })
    this.staff = new StaffService({
      schoolRepository: args.schoolRepository,
      staffMemberRepository: args.staffMemberRepository,
    })
    this.staffAssignments = new StaffAssignmentService({
      staffMemberRepository: args.staffMemberRepository,
      classroomRepository: args.classroomRepository,
      moduleRepository: args.moduleRepository,
      classStaffAssignmentRepository: args.classStaffAssignmentRepository,
      moduleStaffAssignmentRepository: args.moduleStaffAssignmentRepository,
    })
    this.subjectCatalog = new SubjectCatalogService({
      schoolRepository: args.schoolRepository,
      subjectRepository: args.subjectRepository,
    })
    this.modules = new ModuleService({
      classroomRepository: args.classroomRepository,
      subjectRepository: args.subjectRepository,
      staffMemberRepository: args.staffMemberRepository,
      moduleRepository: args.moduleRepository,
      moduleStaffAssignmentRepository: args.moduleStaffAssignmentRepository,
    })
    this.sessions = new SessionService({
      classroomRepository: args.classroomRepository,
      moduleRepository: args.moduleRepository,
      sessionRepository: args.sessionRepository,
    })
    this.assessments = new AssessmentService({
      classroomRepository: args.classroomRepository,
      moduleRepository: args.moduleRepository,
      academicPeriodRepository: args.academicPeriodRepository,
      sessionRepository: args.sessionRepository,
      assessmentRepository: args.assessmentRepository,
      deadlineRepository: args.deadlineRepository,
    })
    const attendance = new AttendanceService({
      studentRepository: args.studentRepository,
      studentEnrollmentRepository: args.studentEnrollmentRepository,
      sessionRepository: args.sessionRepository,
      attendanceRepository: args.attendanceRepository,
    })
    const grades = new GradeService({
      studentRepository: args.studentRepository,
      studentEnrollmentRepository: args.studentEnrollmentRepository,
      subjectRepository: args.subjectRepository,
      assessmentRepository: args.assessmentRepository,
      academicPeriodRepository: args.academicPeriodRepository,
      gradeRepository: args.gradeRepository,
      classroomRepository: args.classroomRepository,
      moduleRepository: args.moduleRepository,
    })

    this.attendance = attendance
    this.grades = grades
    this.reportCards = new ReportCardService({
      studentRepository: args.studentRepository,
      classroomRepository: args.classroomRepository,
      studentEnrollmentRepository: args.studentEnrollmentRepository,
      academicPeriodRepository: args.academicPeriodRepository,
      gradeRepository: args.gradeRepository,
      reportCardRepository: args.reportCardRepository,
      attendanceService: attendance,
      gradeService: grades,
    })
    this.announcements = new AnnouncementService({
      classroomRepository: args.classroomRepository,
      announcementRepository: args.announcementRepository,
    })
    this.fees = new FeeService({
      studentRepository: args.studentRepository,
      schoolFeeRepository: args.schoolFeeRepository,
    })
    this.deadlines = new DeadlineService({
      schoolRepository: args.schoolRepository,
      classroomRepository: args.classroomRepository,
      moduleRepository: args.moduleRepository,
      studentRepository: args.studentRepository,
      studentEnrollmentRepository: args.studentEnrollmentRepository,
      deadlineRepository: args.deadlineRepository,
      deadlineRecordRepository: args.deadlineRecordRepository,
    })
    this.workspace = new WorkspaceService({
      schoolRepository: args.schoolRepository,
      academicYearRepository: args.academicYearRepository,
      academicPeriodRepository: args.academicPeriodRepository,
      classroomRepository: args.classroomRepository,
      staffMemberRepository: args.staffMemberRepository,
      moduleRepository: args.moduleRepository,
      moduleStaffAssignmentRepository: args.moduleStaffAssignmentRepository,
    })
    this.schoolOverview = new SchoolOverviewService({
      schoolRepository: args.schoolRepository,
      academicYearRepository: args.academicYearRepository,
      classroomRepository: args.classroomRepository,
      studentRepository: args.studentRepository,
      announcementRepository: args.announcementRepository,
      schoolFeeRepository: args.schoolFeeRepository,
      reportCardRepository: args.reportCardRepository,
    })
    this.studentDirectory = new StudentDirectoryService({
      schoolRepository: args.schoolRepository,
      academicYearRepository: args.academicYearRepository,
      classroomRepository: args.classroomRepository,
      studentRepository: args.studentRepository,
      studentEnrollmentRepository: args.studentEnrollmentRepository,
      guardianStudentLinkRepository: args.guardianStudentLinkRepository,
      reportCardRepository: args.reportCardRepository,
      schoolFeeRepository: args.schoolFeeRepository,
    })
    this.classroomRead = new ClassroomReadService({
      academicYearRepository: args.academicYearRepository,
      classroomRepository: args.classroomRepository,
      studentEnrollmentRepository: args.studentEnrollmentRepository,
      moduleRepository: args.moduleRepository,
      moduleStaffAssignmentRepository: args.moduleStaffAssignmentRepository,
      staffMemberRepository: args.staffMemberRepository,
      subjectRepository: args.subjectRepository,
      sessionRepository: args.sessionRepository,
    })
    this.attendanceReview = new AttendanceReviewService({
      academicYearRepository: args.academicYearRepository,
      classroomRepository: args.classroomRepository,
      sessionRepository: args.sessionRepository,
      attendanceRepository: args.attendanceRepository,
      studentEnrollmentRepository: args.studentEnrollmentRepository,
      studentRepository: args.studentRepository,
      moduleRepository: args.moduleRepository,
      subjectRepository: args.subjectRepository,
    })
  }
}
