import type { ClassGroup } from '../../../entities/school/class-group'
import type { Student } from '../../../entities/students/student'
import type { SchoolRepositories } from '../../../ports/school-repositories'
import type { AuthorizationAction, AuthorizedServiceArgs } from '../../authorization'
import type { ServiceArgs } from '../../school-headless-app'
import type { PaginationParams } from '../../shared/pagination'
import type { AssessmentEntryReview, ReportCardDetail } from './assessments'
import type { AttendanceReview } from './attendance'
import type { AcademicCalendar } from './calendar'
import type { ClassGroupCourseAssignment, ClassGroupDirectory, ClassGroupTimetableEntry } from './class-groups'
import type { AnnouncementDetail, AnnouncementDirectory } from './communications'
import type { ClassSubjectProgressDetail } from './curriculum'
import type { FinanceLedger } from './finance'
import type { IncidentDetail, StudentIncidentDirectory } from './incidents'
import type { SchoolOverview } from './overview'
import type { AttachmentDirectory, ResourceDirectory } from './resources'
import type {
  StudentDetail,
  StudentDirectory,
  StudentEnrollmentHistory,
} from './students'
import type { WorkspaceContext } from './workspace'
import { AuthorizationError, AuthorizationErrorCode, denyResourceAccess } from '../../authorization'
import { AssessmentEntryReviewService, ReportCardDetailService } from './assessments'
import { resolveAttachmentOwnerContext } from './attachment-resolver'
import { AttendanceReviewService } from './attendance'
import { CalendarReadService } from './calendar'
import { ClassGroupReadService } from './class-groups'
import { CommunicationsReadService } from './communications'
import { CurriculumProgressReadService } from './curriculum'
import { FinanceLedgerService } from './finance'
import { IncidentReadService } from './incidents'
import { SchoolOverviewService } from './overview'
import { AttachmentReadService, ResourceReadService } from './resources'
import {
  StudentDetailService,
  StudentDirectoryService,
  StudentEnrollmentHistoryService,
} from './students'
import { WorkspaceService } from './workspace'

// Re-export all public response types so consumers can import from a single location.
export type { PaginationParams }
export type { AcademicCalendar }
export type { AnnouncementDetail, AnnouncementDirectory }
export type { AssessmentEntryReview, ReportCardDetail }
export type { AttachmentDirectory, ResourceDirectory }
export type { AttendanceReview }
export type { ClassGroupCourseAssignment, ClassGroupDirectory, ClassGroupTimetableEntry }
export type { ClassSubjectProgressDetail }
export type { FinanceLedger }
export type { IncidentDetail, StudentIncidentDirectory }
export type { SchoolOverview }
export type { StudentDetail, StudentDirectory, StudentEnrollmentHistory }
export type { WorkspaceContext }

export type {
  AssessmentEntryReviewRow,
  ReportCardDetailAssessmentResult,
} from './assessments'
export type {
  AttendanceReviewRow,
  AttendanceReviewSummary,
  AttendanceSessionOption,
} from './attendance'
export type {
  ClassGroupOverviewRow,
} from './class-groups'
export type { AnnouncementDeliverySummary } from './communications'
export type {
  CurriculumMatterProgressDetail,
  CurriculumProgressHistoryEntry,
} from './curriculum'
export type { FinanceLedgerItem } from './finance'
export type {
  IncidentDisciplinaryActionDetail,
  IncidentInvolvementDetail,
  StudentIncidentSummary,
} from './incidents'
export type {
  StudentDetailGuardian,
  StudentDetailVisibility,
  StudentDirectoryRow,
  StudentEnrollmentHistoryRow,
} from './students'
// Also re-export nested types that consumers reference directly
export type { TeacherCourseLoad } from './workspace'

export class SchoolQueryService {
  private readonly workspace: WorkspaceService
  private readonly schoolOverview: SchoolOverviewService
  private readonly studentDirectory: StudentDirectoryService
  private readonly studentDetail: StudentDetailService
  private readonly studentEnrollmentHistory: StudentEnrollmentHistoryService
  private readonly reportCardDetail: ReportCardDetailService
  private readonly assessmentEntryReview: AssessmentEntryReviewService
  private readonly communicationsRead: CommunicationsReadService
  private readonly calendarRead: CalendarReadService
  private readonly resourceRead: ResourceReadService
  private readonly attachmentRead: AttachmentReadService
  private readonly curriculumProgressRead: CurriculumProgressReadService
  private readonly financeLedger: FinanceLedgerService
  private readonly classGroupRead: ClassGroupReadService
  private readonly attendanceReview: AttendanceReviewService
  private readonly incidentRead: IncidentReadService

  private readonly repositories: SchoolRepositories

  private readonly actor: AuthorizedServiceArgs['actor']
  private readonly authorizationPolicy: AuthorizedServiceArgs['authorizationPolicy']

  constructor(args: ServiceArgs) {
    this.actor = args.actor
    this.authorizationPolicy = args.authorizationPolicy
    this.workspace = new WorkspaceService(args)
    this.schoolOverview = new SchoolOverviewService(args)
    this.studentDirectory = new StudentDirectoryService(args)
    this.studentDetail = new StudentDetailService(args)
    this.studentEnrollmentHistory = new StudentEnrollmentHistoryService(args)
    this.reportCardDetail = new ReportCardDetailService(args)
    this.assessmentEntryReview = new AssessmentEntryReviewService(args)
    this.communicationsRead = new CommunicationsReadService(args)
    this.calendarRead = new CalendarReadService(args)
    this.resourceRead = new ResourceReadService(args)
    this.attachmentRead = new AttachmentReadService(args)
    this.curriculumProgressRead = new CurriculumProgressReadService(args)
    this.financeLedger = new FinanceLedgerService(args)
    this.classGroupRead = new ClassGroupReadService(args)
    this.attendanceReview = new AttendanceReviewService(args)
    this.incidentRead = new IncidentReadService(args)
    this.repositories = args.repositories
  }

  async getWorkspaceContext(input: Parameters<WorkspaceService['getWorkspaceContext']>[0]): Promise<WorkspaceContext> {
    await this.authorizeSchool('queries.read_workspace', input.schoolId, input.classGroupId)
    return this.workspace.getWorkspaceContext(input)
  }

  async getSchoolOverview(input: Parameters<SchoolOverviewService['getSchoolOverview']>[0]): Promise<SchoolOverview> {
    await this.authorizeSchool('queries.read_overview', input.schoolId)
    return this.schoolOverview.getSchoolOverview(input)
  }

  async listStudents(input: Parameters<StudentDirectoryService['listStudents']>[0]): Promise<StudentDirectory> {
    await this.authorizeSchool('queries.read_student_directory', input.schoolId)
    await this.requireAcademicYearInSchool(input.academicYearId, input.schoolId)
    return this.studentDirectory.listStudents(input)
  }

  async getStudentDetail(input: Parameters<StudentDetailService['getStudentDetail']>[0]): Promise<StudentDetail> {
    await this.requireStudentInSchool(input.studentId, input.schoolId)
    const currentEnrollment = await this.repositories.enrollments.findActiveByStudent(input.studentId)
    const classGroup = currentEnrollment ? await this.repositories.classGroups.findById(currentEnrollment.classGroupId) : undefined
    if (currentEnrollment && (!classGroup || classGroup.schoolId !== input.schoolId)) {
      denyResourceAccess()
    }
    await this.authorizationPolicy.requirePermission(this.actor, {
      action: 'queries.read_student_detail',
      resource: {
        schoolId: input.schoolId,
        studentId: input.studentId,
        classGroupId: classGroup?.id,
      },
    })
    return this.studentDetail.getStudentDetail(input)
  }

  async getFinanceLedger(input: Parameters<FinanceLedgerService['getFinanceLedger']>[0]): Promise<FinanceLedger> {
    await this.requireStudentInSchool(input.studentId, input.schoolId)
    await this.requireAcademicYearInSchool(input.academicYearId, input.schoolId)
    await this.authorizationPolicy.requirePermission(this.actor, {
      action: 'finance.read',
      resource: {
        schoolId: input.schoolId,
        studentId: input.studentId,
      },
    })
    return this.financeLedger.getFinanceLedger(input)
  }

  async getStudentEnrollmentHistory(
    input: Parameters<StudentEnrollmentHistoryService['getStudentEnrollmentHistory']>[0],
  ): Promise<StudentEnrollmentHistory> {
    await this.requireStudentInSchool(input.studentId, input.schoolId)
    await this.authorizationPolicy.requirePermission(this.actor, {
      action: 'queries.read_enrollment_history',
      resource: {
        schoolId: input.schoolId,
        studentId: input.studentId,
      },
    })
    return this.studentEnrollmentHistory.getStudentEnrollmentHistory(input)
  }

  async getReportCardDetail(
    input: Parameters<ReportCardDetailService['getReportCardDetail']>[0],
  ): Promise<ReportCardDetail> {
    const reportCard = await this.repositories.results.findById(input.reportCardResultId)
    const classGroup = reportCard ? await this.repositories.classGroups.findById(reportCard.classGroupId) : undefined
    if (!reportCard || !classGroup || classGroup.schoolId !== input.schoolId) {
      denyResourceAccess()
    }
    await this.authorizationPolicy.requirePermission(this.actor, {
      action: 'queries.read_report_card_detail',
      resource: {
        schoolId: input.schoolId,
        classGroupId: classGroup.id,
        studentId: reportCard.studentId,
        reportCardResultId: reportCard.id,
      },
    })
    return this.reportCardDetail.getReportCardDetail(input)
  }

  async getAssessmentEntryReview(
    input: Parameters<AssessmentEntryReviewService['getAssessmentEntryReview']>[0],
  ): Promise<AssessmentEntryReview> {
    const assessment = await this.repositories.assessments.findById(input.assessmentId)
    const [classGroup, classSubject] = assessment
      ? await Promise.all([
          this.repositories.classGroups.findById(assessment.classGroupId),
          this.repositories.classSubjects.findById(assessment.classSubjectId),
        ])
      : []
    if (
      !assessment
      || !classGroup
      || !classSubject
      || classGroup.schoolId !== input.schoolId
      || classSubject.classGroupId !== classGroup.id
    ) {
      denyResourceAccess()
    }
    await this.authorizationPolicy.requirePermission(this.actor, {
      action: 'assessments.read_results',
      resource: {
        schoolId: input.schoolId,
        classGroupId: classGroup.id,
        classSubjectId: classSubject.id,
      },
    })
    return this.assessmentEntryReview.getAssessmentEntryReview(input)
  }

  async listAnnouncements(input: Parameters<CommunicationsReadService['listAnnouncements']>[0]): Promise<AnnouncementDirectory> {
    await this.authorizeSchool('queries.read_communications', input.schoolId)
    return this.communicationsRead.listAnnouncements(input)
  }

  async getAnnouncementDetail(
    input: Parameters<CommunicationsReadService['getAnnouncementDetail']>[0],
  ): Promise<AnnouncementDetail> {
    const announcement = await this.repositories.announcements.findById(input.announcementId)
    if (!announcement || announcement.schoolId !== input.schoolId) {
      denyResourceAccess()
    }
    await this.authorizationPolicy.requirePermission(this.actor, {
      action: 'queries.read_communications',
      resource: {
        schoolId: input.schoolId,
        announcementId: announcement.id,
      },
    })
    return this.communicationsRead.getAnnouncementDetail(input)
  }

  async getCalendarEvents(input: Parameters<CalendarReadService['getCalendarEvents']>[0]): Promise<AcademicCalendar> {
    await this.requireAcademicYearInSchool(input.academicYearId, input.schoolId)
    const classGroup = input.classGroupId
      ? await this.requireClassGroupInSchool(input.classGroupId, input.schoolId, input.academicYearId)
      : undefined
    await this.authorizationPolicy.requirePermission(this.actor, {
      action: 'queries.read_calendar',
      resource: {
        schoolId: input.schoolId,
        academicYearId: input.academicYearId,
        classGroupId: classGroup?.id,
      },
    })
    return this.calendarRead.getCalendarEvents(input)
  }

  async listResources(input: Parameters<ResourceReadService['listResources']>[0]): Promise<ResourceDirectory> {
    await this.authorizationPolicy.requirePermission(this.actor, {
      action: 'resources.read',
      resource: { schoolId: input.schoolId },
    })
    return this.resourceRead.listResources(input)
  }

  async listAttachments(input: Parameters<AttachmentReadService['listAttachments']>[0]): Promise<AttachmentDirectory> {
    const context = await resolveAttachmentOwnerContext(this.repositories, input.ownerKind, input.ownerId, input.schoolId)
    await this.authorizationPolicy.requirePermission(this.actor, {
      action: 'attachments.read',
      resource: {
        schoolId: input.schoolId,
        classGroupId: context.classGroupId,
        sessionId: context.sessionId,
        studentId: context.studentId,
      },
    })
    return this.attachmentRead.listAttachments(input)
  }

  async getClassSubjectProgressDetail(
    input: Parameters<CurriculumProgressReadService['getClassSubjectProgressDetail']>[0],
  ): Promise<ClassSubjectProgressDetail> {
    const classSubject = await this.repositories.classSubjects.findById(input.classSubjectId)
    const classGroup = classSubject ? await this.repositories.classGroups.findById(classSubject.classGroupId) : undefined
    if (!classSubject || !classGroup || classGroup.schoolId !== input.schoolId) {
      denyResourceAccess()
    }
    await this.authorizationPolicy.requirePermission(this.actor, {
      action: 'queries.read_curriculum_progress',
      resource: {
        schoolId: input.schoolId,
        classGroupId: classGroup.id,
        classSubjectId: classSubject.id,
      },
    })
    return this.curriculumProgressRead.getClassSubjectProgressDetail(input)
  }

  async listClassGroups(input: Parameters<ClassGroupReadService['listClassGroups']>[0]): Promise<ClassGroupDirectory> {
    await this.authorizeSchool('queries.read_class_directory', input.schoolId)
    await this.requireAcademicYearInSchool(input.academicYearId, input.schoolId)
    return this.classGroupRead.listClassGroups(input)
  }

  async listClassGroupCourses(
    input: Parameters<ClassGroupReadService['listClassGroupCourses']>[0],
  ): Promise<ClassGroupCourseAssignment[]> {
    await this.authorizeClassGroup('queries.read_class_curriculum', input)
    return this.classGroupRead.listClassGroupCourses(input)
  }

  async listClassGroupTimetable(
    input: Parameters<ClassGroupReadService['listClassGroupTimetable']>[0],
  ): Promise<ClassGroupTimetableEntry[]> {
    await this.authorizeClassGroup('queries.read_timetable', input)
    return this.classGroupRead.listClassGroupTimetable(input)
  }

  async getAttendanceSessionReview(
    input: Parameters<AttendanceReviewService['getAttendanceSessionReview']>[0],
  ): Promise<AttendanceReview> {
    const classGroup = await this.requireClassGroupInSchool(
      input.classGroupId,
      input.schoolId,
      input.academicYearId,
    )
    const session = input.sessionId
      ? await this.requireSessionInSchool(input.sessionId, input.schoolId)
      : undefined
    if (session && session.classGroupId !== classGroup.id) {
      denyResourceAccess()
    }
    await this.authorizationPolicy.requirePermission(this.actor, {
      action: 'queries.read_attendance',
      resource: {
        schoolId: input.schoolId,
        sessionId: session?.id,
        classGroupId: classGroup.id,
      },
    })
    return this.attendanceReview.getAttendanceSessionReview(input)
  }

  async getIncidentDetail(input: Parameters<IncidentReadService['getIncidentDetail']>[0]): Promise<IncidentDetail> {
    const incident = await this.repositories.incidents.findById(input.incidentId)
    if (!incident || incident.schoolId !== input.schoolId) {
      denyResourceAccess()
    }
    await this.authorizationPolicy.requirePermission(this.actor, {
      action: 'behavior.read_incidents',
      resource: {
        schoolId: input.schoolId,
        classGroupId: incident.classGroupId,
        sessionId: incident.sessionId,
      },
    })
    return this.incidentRead.getIncidentDetail(input)
  }

  async listStudentIncidents(
    input: Parameters<IncidentReadService['listStudentIncidents']>[0],
  ): Promise<StudentIncidentDirectory> {
    await this.requireStudentInSchool(input.studentId, input.schoolId)
    const currentEnrollment = await this.repositories.enrollments.findActiveByStudent(input.studentId)
    const classGroup = currentEnrollment ? await this.repositories.classGroups.findById(currentEnrollment.classGroupId) : undefined
    if (currentEnrollment && (!classGroup || classGroup.schoolId !== input.schoolId)) {
      denyResourceAccess()
    }
    await this.authorizationPolicy.requirePermission(this.actor, {
      action: 'behavior.read_incidents',
      resource: {
        schoolId: input.schoolId,
        studentId: input.studentId,
        classGroupId: classGroup?.id,
      },
    })
    return this.incidentRead.listStudentIncidents(input)
  }

  async listStudentsForGuardian(guardianId: string): Promise<Student[]> {
    const guardian = await this.repositories.guardians.findById(guardianId)
    if (!guardian) {
      denyResourceAccess()
    }
    await this.authorizationPolicy.requirePermission(this.actor, {
      action: this.actor.kind === 'guardian' ? 'queries.read_guardian_self' : 'queries.read_guardian_students_admin',
      resource: { schoolId: guardian.schoolId, guardianId },
    })
    const links = await this.repositories.guardianLinks.list({ guardianId })
    const students = await Promise.all(links.map(link => this.repositories.students.findById(link.studentId)))
    return students.filter(student => student !== undefined)
  }

  async listMyStudents(): Promise<Student[]> {
    if (this.actor.kind !== 'guardian') {
      throw new AuthorizationError(AuthorizationErrorCode.GuardianActorRequired)
    }
    return this.listStudentsForGuardian(this.actor.guardianId)
  }

  // ---------------------------------------------------------------------------
  // Private authorization helpers
  // ---------------------------------------------------------------------------

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
    const classGroup = await this.repositories.classGroups.findById(classGroupId)
    if (!classGroup) {
      denyResourceAccess()
    }
    await this.authorizeSchool(action, classGroup.schoolId, classGroup.id)
  }

  private async requireSessionInSchool(sessionId: string, schoolId: string) {
    const session = await this.repositories.sessions.findById(sessionId)
    const classGroup = session ? await this.repositories.classGroups.findById(session.classGroupId) : undefined
    if (!session || !classGroup || classGroup.schoolId !== schoolId) {
      denyResourceAccess()
    }
    return session
  }

  private async requireClassGroupInSchool(
    classGroupId: string,
    schoolId: string,
    academicYearId?: string,
  ): Promise<ClassGroup> {
    const classGroup = await this.repositories.classGroups.findById(classGroupId)
    if (
      !classGroup
      || classGroup.schoolId !== schoolId
      || (academicYearId !== undefined && classGroup.academicYearId !== academicYearId)
    ) {
      denyResourceAccess()
    }
    await this.requireAcademicYearInSchool(academicYearId, schoolId)
    return classGroup
  }

  private async requireStudentInSchool(studentId: string, schoolId: string): Promise<Student> {
    const student = await this.repositories.students.findById(studentId)
    if (!student || student.schoolId !== schoolId) {
      denyResourceAccess()
    }
    return student
  }

  private async requireAcademicYearInSchool(academicYearId: string | undefined, schoolId: string): Promise<void> {
    if (!academicYearId) {
      return
    }
    const academicYear = await this.repositories.academicYears.findById(academicYearId)
    if (!academicYear || academicYear.schoolId !== schoolId) {
      denyResourceAccess()
    }
  }
}
