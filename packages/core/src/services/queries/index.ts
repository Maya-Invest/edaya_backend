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
import type { AuthorizationAction, AuthorizedServiceArgs } from '../authorization'
import { AuthorizationError, AuthorizationErrorCode, denyResourceAccess } from '../authorization'
import { AttendanceReviewService } from './attendance-review'
import { ClassGroupReadService } from './class-group-read'
import { SchoolOverviewService } from './school-overview'
import { StudentDirectoryService } from './student-directory'
import { WorkspaceService } from './workspace'

export interface SchoolQueryServiceArgs extends AuthorizedServiceArgs {
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
  private readonly actor: AuthorizedServiceArgs['actor']
  private readonly authorizationPolicy: AuthorizedServiceArgs['authorizationPolicy']
  private readonly classGroupRepository: ClassGroupRepository
  private readonly sessionRepository: SessionRepository
  private readonly academicYearRepository: AcademicYearRepository

  constructor(args: SchoolQueryServiceArgs) {
    this.actor = args.actor
    this.authorizationPolicy = args.authorizationPolicy
    this.workspace = new WorkspaceService(args)
    this.schoolOverview = new SchoolOverviewService(args)
    this.studentDirectory = new StudentDirectoryService(args)
    this.classGroupRead = new ClassGroupReadService(args)
    this.attendanceReview = new AttendanceReviewService(args)
    this.guardianRepository = args.guardianRepository
    this.guardianStudentLinks = args.guardianStudentLinkRepository
    this.studentRepository = args.studentRepository
    this.classGroupRepository = args.classGroupRepository
    this.sessionRepository = args.sessionRepository
    this.academicYearRepository = args.academicYearRepository
  }

  async getWorkspaceContext(input: Parameters<WorkspaceService['getWorkspaceContext']>[0]) {
    await this.authorizeSchool('queries.read_workspace', input.schoolId, input.classGroupId)
    return this.workspace.getWorkspaceContext(input)
  }

  async getSchoolOverview(input: Parameters<SchoolOverviewService['getSchoolOverview']>[0]) {
    await this.authorizeSchool('queries.read_overview', input.schoolId)
    return this.schoolOverview.getSchoolOverview(input)
  }

  async listStudents(input: Parameters<StudentDirectoryService['listStudents']>[0]) {
    await this.authorizeSchool('queries.read_student_directory', input.schoolId)
    await this.requireAcademicYearInSchool(input.academicYearId, input.schoolId)
    return this.studentDirectory.listStudents(input)
  }

  async listClassGroups(input: Parameters<ClassGroupReadService['listClassGroups']>[0]) {
    await this.authorizeSchool('queries.read_class_directory', input.schoolId)
    await this.requireAcademicYearInSchool(input.academicYearId, input.schoolId)
    return this.classGroupRead.listClassGroups(input)
  }

  async listClassGroupCourses(input: Parameters<ClassGroupReadService['listClassGroupCourses']>[0]) {
    await this.authorizeClassGroup('queries.read_class_curriculum', input)
    return this.classGroupRead.listClassGroupCourses(input)
  }

  async listClassGroupTimetable(input: Parameters<ClassGroupReadService['listClassGroupTimetable']>[0]) {
    await this.authorizeClassGroup('queries.read_timetable', input)
    return this.classGroupRead.listClassGroupTimetable(input)
  }

  async getAttendanceSessionReview(input: Parameters<AttendanceReviewService['getAttendanceSessionReview']>[0]) {
    const session = input.sessionId
      ? await this.requireSessionInSchool(input.sessionId, input.schoolId)
      : undefined
    await this.authorizationPolicy.requirePermission(this.actor, {
      action: 'queries.read_attendance',
      resource: {
        schoolId: input.schoolId,
        sessionId: session?.id,
        classGroupId: session?.classGroupId,
      },
    })
    return this.attendanceReview.getAttendanceSessionReview(input)
  }

  async listStudentsForGuardian(guardianId: string) {
    const guardian = await this.guardianRepository.findById(guardianId)
    if (!guardian) {
      denyResourceAccess()
    }
    await this.authorizationPolicy.requirePermission(this.actor, {
      action: this.actor.kind === 'guardian' ? 'queries.read_guardian_self' : 'queries.read_guardian_students_admin',
      resource: { schoolId: guardian.schoolId, guardianId },
    })
    const links = await this.guardianStudentLinks.listByGuardian(guardianId)
    const students = await Promise.all(links.map(link => this.studentRepository.findById(link.studentId)))
    return students.filter(student => student !== undefined)
  }

  async listMyStudents() {
    if (this.actor.kind !== 'guardian') {
      throw new AuthorizationError(AuthorizationErrorCode.GuardianActorRequired)
    }
    return this.listStudentsForGuardian(this.actor.guardianId)
  }

  private async authorizeSchool(
    action: Extract<AuthorizationAction, `queries.${string}`>,
    schoolId: string,
    classGroupId?: string,
  ): Promise<void> {
    await this.authorizationPolicy.requirePermission(this.actor, {
      action,
      resource: { schoolId, classGroupId },
    })
  }

  private async authorizeClassGroup(
    action: Extract<AuthorizationAction, `queries.${string}`>,
    classGroupId: string,
  ): Promise<void> {
    const classGroup = await this.classGroupRepository.findById(classGroupId)
    if (!classGroup) {
      denyResourceAccess()
    }
    await this.authorizeSchool(action, classGroup.schoolId, classGroup.id)
  }

  private async requireSessionInSchool(sessionId: string, schoolId: string) {
    const session = await this.sessionRepository.findById(sessionId)
    const classGroup = session ? await this.classGroupRepository.findById(session.classGroupId) : undefined
    if (!session || !classGroup || classGroup.schoolId !== schoolId) {
      denyResourceAccess()
    }
    return session
  }

  private async requireAcademicYearInSchool(academicYearId: string | undefined, schoolId: string): Promise<void> {
    if (!academicYearId) {
      return
    }
    const academicYear = await this.academicYearRepository.findById(academicYearId)
    if (!academicYear || academicYear.schoolId !== schoolId) {
      denyResourceAccess()
    }
  }
}
