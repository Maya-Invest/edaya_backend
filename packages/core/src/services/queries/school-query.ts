import type { AcademicPeriodRepository } from '../../ports/academic-period-repository'
import type { AcademicYearRepository } from '../../ports/academic-year-repository'
import type { AnnouncementRepository } from '../../ports/announcement-repository'
import type { AttendanceRepository } from '../../ports/attendance-repository'
import type { ClassGroupRepository } from '../../ports/class-group-repository'
import type { ClassSubjectRepository } from '../../ports/class-subject-repository'
import type { GuardianRepository } from '../../ports/guardian-repository'
import type { GuardianStudentLinkRepository } from '../../ports/guardian-student-link-repository'
import type { ReportCardResultRepository } from '../../ports/report-card-result-repository'
import type { SchoolRepository } from '../../ports/school-repository'
import type { SessionRepository } from '../../ports/session-repository'
import type { StaffAssignmentRepository } from '../../ports/staff-assignment-repository'
import type { StaffMemberRepository } from '../../ports/staff-member-repository'
import type { StudentClassEnrollmentRepository } from '../../ports/student-enrollment-repository'
import type { StudentFeeRepository } from '../../ports/student-fee-repository'
import type { StudentRepository } from '../../ports/student-repository'
import type { SubjectRepository } from '../../ports/subject-repository'
import { AttendanceReviewService } from '../planing/attendance-review'
import { ClassGroupReadService } from '../workspace/class-group-read'
import { SchoolOverviewService } from '../workspace/school-overview'
import { StudentDirectoryService } from '../workspace/student-directory'
import { WorkspaceService } from '../workspace/workspace'

export interface SchoolQueryServiceArgs {
  schoolRepository: SchoolRepository
  academicYearRepository: AcademicYearRepository
  academicPeriodRepository: AcademicPeriodRepository
  classGroupRepository: ClassGroupRepository
  studentRepository: StudentRepository
  StudentClassEnrollmentRepository: StudentClassEnrollmentRepository
  guardianRepository: GuardianRepository
  guardianStudentLinkRepository: GuardianStudentLinkRepository
  staffMemberRepository: StaffMemberRepository
  staffAssignmentRepository: StaffAssignmentRepository
  subjectRepository: SubjectRepository
  classSubjectRepository: ClassSubjectRepository
  sessionRepository: SessionRepository
  attendanceRepository: AttendanceRepository
  announcementRepository: AnnouncementRepository
  studentFeeRepository: StudentFeeRepository
  reportCardResultRepository: ReportCardResultRepository
}

export class SchoolQueryService {
  private readonly workspace: WorkspaceService
  private readonly schoolOverview: SchoolOverviewService
  private readonly studentDirectory: StudentDirectoryService
  private readonly classGroupRead: ClassGroupReadService
  private readonly attendanceReview: AttendanceReviewService
  private readonly guardianRepository: GuardianRepository
  private readonly guardianStudentLinks: GuardianStudentLinkRepository
  private readonly studentRepository: StudentRepository

  constructor(args: SchoolQueryServiceArgs) {
    this.workspace = new WorkspaceService(args)
    this.schoolOverview = new SchoolOverviewService(args)
    this.studentDirectory = new StudentDirectoryService(args)
    this.classGroupRead = new ClassGroupReadService(args)
    this.attendanceReview = new AttendanceReviewService(args)
    this.guardianRepository = args.guardianRepository
    this.guardianStudentLinks = args.guardianStudentLinkRepository
    this.studentRepository = args.studentRepository
  }

  getWorkspaceContext(input: Parameters<WorkspaceService['getWorkspaceContext']>[0]) {
    return this.workspace.getWorkspaceContext(input)
  }

  getSchoolOverview(input: Parameters<SchoolOverviewService['getSchoolOverview']>[0]) {
    return this.schoolOverview.getSchoolOverview(input)
  }

  listStudents(input: Parameters<StudentDirectoryService['listStudents']>[0]) {
    return this.studentDirectory.listStudents(input)
  }

  listClassGroups(input: Parameters<ClassGroupReadService['listClassGroups']>[0]) {
    return this.classGroupRead.listClassGroups(input)
  }

  listClassGroupCourses(input: Parameters<ClassGroupReadService['listClassGroupCourses']>[0]) {
    return this.classGroupRead.listClassGroupCourses(input)
  }

  listClassGroupTimetable(input: Parameters<ClassGroupReadService['listClassGroupTimetable']>[0]) {
    return this.classGroupRead.listClassGroupTimetable(input)
  }

  getAttendanceSessionReview(input: Parameters<AttendanceReviewService['getAttendanceSessionReview']>[0]) {
    return this.attendanceReview.getAttendanceSessionReview(input)
  }

  async listStudentsForGuardian(guardianId: string) {
    if (!await this.guardianRepository.findById(guardianId)) {
      throw new Error(`Unknown guardian: ${guardianId}`)
    }
    const links = await this.guardianStudentLinks.listByGuardian(guardianId)
    const students = await Promise.all(links.map(link => this.studentRepository.findById(link.studentId)))
    return students.filter(student => student !== undefined)
  }
}
