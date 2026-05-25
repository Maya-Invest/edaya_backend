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
  private readonly guardianRepository: SchoolRepositories['students']['guardians']
  private readonly guardianStudentLinks: SchoolRepositories['students']['guardianLinks']
  private readonly studentRepository: SchoolRepositories['students']['students']
  private readonly actor: AuthorizedServiceArgs['actor']
  private readonly authorizationPolicy: AuthorizedServiceArgs['authorizationPolicy']
  private readonly classGroupRepository: SchoolRepositories['academics']['classGroups']
  private readonly sessionRepository: SchoolRepositories['scheduling']['sessions']
  private readonly academicYearRepository: SchoolRepositories['setup']['academicYears']

  constructor(args: SchoolQueryServiceArgs) {
    this.actor = args.actor
    this.authorizationPolicy = args.authorizationPolicy
    this.workspace = new WorkspaceService({
      schoolRepository: args.repositories.setup.schools,
      academicYearRepository: args.repositories.setup.academicYears,
      academicPeriodRepository: args.repositories.setup.academicPeriods,
      classGroupRepository: args.repositories.academics.classGroups,
      staffMemberRepository: args.repositories.setup.staffMembers,
      classSubjectRepository: args.repositories.academics.classSubjects,
      staffAssignmentRepository: args.repositories.setup.staffAssignments,
    })
    this.schoolOverview = new SchoolOverviewService({
      schoolRepository: args.repositories.setup.schools,
      academicYearRepository: args.repositories.setup.academicYears,
      classGroupRepository: args.repositories.academics.classGroups,
      studentRepository: args.repositories.students.students,
      announcementRepository: args.repositories.communications.announcements,
      studentFeeRepository: args.repositories.finance.studentFees,
      reportCardResultRepository: args.repositories.assessments.results,
    })
    this.studentDirectory = new StudentDirectoryService({
      schoolRepository: args.repositories.setup.schools,
      academicYearRepository: args.repositories.setup.academicYears,
      classGroupRepository: args.repositories.academics.classGroups,
      studentRepository: args.repositories.students.students,
      StudentClassEnrollmentRepository: args.repositories.students.enrollments,
      guardianStudentLinkRepository: args.repositories.students.guardianLinks,
      reportCardResultRepository: args.repositories.assessments.results,
      studentFeeRepository: args.repositories.finance.studentFees,
    })
    this.classGroupRead = new ClassGroupReadService({
      academicYearRepository: args.repositories.setup.academicYears,
      classGroupRepository: args.repositories.academics.classGroups,
      StudentClassEnrollmentRepository: args.repositories.students.enrollments,
      classSubjectRepository: args.repositories.academics.classSubjects,
      staffAssignmentRepository: args.repositories.setup.staffAssignments,
      staffMemberRepository: args.repositories.setup.staffMembers,
      subjectRepository: args.repositories.academics.subjects,
      sessionRepository: args.repositories.scheduling.sessions,
    })
    this.attendanceReview = new AttendanceReviewService({
      academicYearRepository: args.repositories.setup.academicYears,
      classGroupRepository: args.repositories.academics.classGroups,
      sessionRepository: args.repositories.scheduling.sessions,
      attendanceRepository: args.repositories.scheduling.attendance,
      StudentClassEnrollmentRepository: args.repositories.students.enrollments,
      studentRepository: args.repositories.students.students,
    })
    this.guardianRepository = args.repositories.students.guardians
    this.guardianStudentLinks = args.repositories.students.guardianLinks
    this.studentRepository = args.repositories.students.students
    this.classGroupRepository = args.repositories.academics.classGroups
    this.sessionRepository = args.repositories.scheduling.sessions
    this.academicYearRepository = args.repositories.setup.academicYears
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
