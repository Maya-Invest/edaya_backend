import type { SchoolRepositories } from '../../ports/school-repositories'
import type { AuthorizationAction, AuthorizedServiceArgs } from '../authorization'
import { AuthorizationError, AuthorizationErrorCode, denyResourceAccess } from '../authorization'
import { AttendanceReviewService } from './attendance-review'
import { ClassGroupReadService } from './class-group-read'
import { SchoolOverviewService } from './school-overview'
import { StudentDirectoryService } from './student-directory'
import { WorkspaceService } from './workspace'

export interface SchoolQueryServiceArgs extends AuthorizedServiceArgs {
  repositories: SchoolRepositories
}

export class SchoolQueryService {
  private readonly workspace: WorkspaceService
  private readonly schoolOverview: SchoolOverviewService
  private readonly studentDirectory: StudentDirectoryService
  private readonly classGroupRead: ClassGroupReadService
  private readonly attendanceReview: AttendanceReviewService
  private readonly guardianRepository: SchoolRepositories['guardians']
  private readonly guardianStudentLinks: SchoolRepositories['guardianLinks']
  private readonly studentRepository: SchoolRepositories['students']
  private readonly actor: AuthorizedServiceArgs['actor']
  private readonly authorizationPolicy: AuthorizedServiceArgs['authorizationPolicy']
  private readonly classGroupRepository: SchoolRepositories['classGroups']
  private readonly sessionRepository: SchoolRepositories['sessions']
  private readonly academicYearRepository: SchoolRepositories['academicYears']

  constructor(args: SchoolQueryServiceArgs) {
    this.actor = args.actor
    this.authorizationPolicy = args.authorizationPolicy
    this.workspace = new WorkspaceService({
      schoolRepository: args.repositories.schools,
      academicYearRepository: args.repositories.academicYears,
      academicPeriodRepository: args.repositories.academicPeriods,
      classGroupRepository: args.repositories.classGroups,
      staffMemberRepository: args.repositories.staffMembers,
      classSubjectRepository: args.repositories.classSubjects,
      staffAssignmentRepository: args.repositories.staffAssignments,
    })
    this.schoolOverview = new SchoolOverviewService({
      schoolRepository: args.repositories.schools,
      academicYearRepository: args.repositories.academicYears,
      classGroupRepository: args.repositories.classGroups,
      studentRepository: args.repositories.students,
      announcementRepository: args.repositories.announcements,
      studentFeeRepository: args.repositories.studentFees,
      reportCardResultRepository: args.repositories.results,
    })
    this.studentDirectory = new StudentDirectoryService({
      schoolRepository: args.repositories.schools,
      academicYearRepository: args.repositories.academicYears,
      classGroupRepository: args.repositories.classGroups,
      studentRepository: args.repositories.students,
      StudentClassEnrollmentRepository: args.repositories.enrollments,
      guardianStudentLinkRepository: args.repositories.guardianLinks,
      reportCardResultRepository: args.repositories.results,
      studentFeeRepository: args.repositories.studentFees,
    })
    this.classGroupRead = new ClassGroupReadService({
      academicYearRepository: args.repositories.academicYears,
      classGroupRepository: args.repositories.classGroups,
      StudentClassEnrollmentRepository: args.repositories.enrollments,
      classSubjectRepository: args.repositories.classSubjects,
      staffAssignmentRepository: args.repositories.staffAssignments,
      staffMemberRepository: args.repositories.staffMembers,
      subjectRepository: args.repositories.subjects,
      sessionRepository: args.repositories.sessions,
    })
    this.attendanceReview = new AttendanceReviewService({
      academicYearRepository: args.repositories.academicYears,
      classGroupRepository: args.repositories.classGroups,
      sessionRepository: args.repositories.sessions,
      attendanceRepository: args.repositories.attendance,
      StudentClassEnrollmentRepository: args.repositories.enrollments,
      studentRepository: args.repositories.students,
    })
    this.guardianRepository = args.repositories.guardians
    this.guardianStudentLinks = args.repositories.guardianLinks
    this.studentRepository = args.repositories.students
    this.classGroupRepository = args.repositories.classGroups
    this.sessionRepository = args.repositories.sessions
    this.academicYearRepository = args.repositories.academicYears
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
    const links = await this.guardianStudentLinks.list({ guardianId })
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
