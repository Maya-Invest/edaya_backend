import type { ClassGroup } from '../../../entities/school/class-group'
import type { Student } from '../../../entities/students/student'
import type { SchoolRepositories } from '../../../ports/school-repositories'
import type { AuthorizationAction, AuthorizedServiceArgs } from '../../authorization'
import type { ServiceArgs } from '../../school-headless-app'
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
import { AttachmentOwnerKind } from '../../../entities/school/attachment'
import { AuthorizationError, AuthorizationErrorCode, denyResourceAccess } from '../../authorization'
import { AssessmentEntryReviewService, ReportCardDetailService } from './assessments'
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

  private readonly guardianRepository: SchoolRepositories['guardians']
  private readonly guardianStudentLinks: SchoolRepositories['guardianLinks']
  private readonly studentRepository: SchoolRepositories['students']
  private readonly enrollmentRepository: SchoolRepositories['enrollments']
  private readonly classGroupRepository: SchoolRepositories['classGroups']
  private readonly sessionRepository: SchoolRepositories['sessions']
  private readonly academicYearRepository: SchoolRepositories['academicYears']
  private readonly reportCardResultRepository: SchoolRepositories['results']
  private readonly assessmentRepository: SchoolRepositories['assessments']
  private readonly classSubjectRepository: SchoolRepositories['classSubjects']
  private readonly announcementRepository: SchoolRepositories['announcements']
  private readonly incidentRepository: SchoolRepositories['incidents']
  private readonly attendanceRepository: SchoolRepositories['attendance']
  private readonly paymentRepository: SchoolRepositories['payments']
  private readonly studentFeeRepository: SchoolRepositories['studentFees']
  private readonly studentHealthProfileRepository: SchoolRepositories['studentHealthProfiles']
  private readonly studentDisciplinaryActionRepository: SchoolRepositories['studentDisciplinaryActions']
  private readonly assessmentResultRepository: SchoolRepositories['assessmentResults']

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
    this.guardianRepository = args.repositories.guardians
    this.guardianStudentLinks = args.repositories.guardianLinks
    this.studentRepository = args.repositories.students
    this.enrollmentRepository = args.repositories.enrollments
    this.classGroupRepository = args.repositories.classGroups
    this.sessionRepository = args.repositories.sessions
    this.academicYearRepository = args.repositories.academicYears
    this.reportCardResultRepository = args.repositories.results
    this.assessmentRepository = args.repositories.assessments
    this.classSubjectRepository = args.repositories.classSubjects
    this.announcementRepository = args.repositories.announcements
    this.incidentRepository = args.repositories.incidents
    this.attendanceRepository = args.repositories.attendance
    this.paymentRepository = args.repositories.payments
    this.studentFeeRepository = args.repositories.studentFees
    this.studentHealthProfileRepository = args.repositories.studentHealthProfiles
    this.studentDisciplinaryActionRepository = args.repositories.studentDisciplinaryActions
    this.assessmentResultRepository = args.repositories.assessmentResults
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
    const currentEnrollment = await this.enrollmentRepository.findActiveByStudent(input.studentId)
    const classGroup = currentEnrollment ? await this.classGroupRepository.findById(currentEnrollment.classGroupId) : undefined
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
    const reportCard = await this.reportCardResultRepository.findById(input.reportCardResultId)
    const classGroup = reportCard ? await this.classGroupRepository.findById(reportCard.classGroupId) : undefined
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
    const assessment = await this.assessmentRepository.findById(input.assessmentId)
    const [classGroup, classSubject] = assessment
      ? await Promise.all([
          this.classGroupRepository.findById(assessment.classGroupId),
          this.classSubjectRepository.findById(assessment.classSubjectId),
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
    const announcement = await this.announcementRepository.findById(input.announcementId)
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
    const context = await this.resolveAttachmentOwnerResource(input.ownerKind, input.ownerId, input.schoolId)
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
    const classSubject = await this.classSubjectRepository.findById(input.classSubjectId)
    const classGroup = classSubject ? await this.classGroupRepository.findById(classSubject.classGroupId) : undefined
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
    const incident = await this.incidentRepository.findById(input.incidentId)
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
    const currentEnrollment = await this.enrollmentRepository.findActiveByStudent(input.studentId)
    const classGroup = currentEnrollment ? await this.classGroupRepository.findById(currentEnrollment.classGroupId) : undefined
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

  private async requireClassGroupInSchool(
    classGroupId: string,
    schoolId: string,
    academicYearId?: string,
  ): Promise<ClassGroup> {
    const classGroup = await this.classGroupRepository.findById(classGroupId)
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
    const student = await this.studentRepository.findById(studentId)
    if (!student || student.schoolId !== schoolId) {
      denyResourceAccess()
    }
    return student
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

  private async resolveAttachmentOwnerResource(
    ownerKind: AttachmentOwnerKind,
    ownerId: string,
    schoolId: string,
  ): Promise<{ classGroupId?: string, sessionId?: string, studentId?: string }> {
    switch (ownerKind) {
      case AttachmentOwnerKind.Student:
        return this.resolveStudentAttachmentResource(ownerId, schoolId)
      case AttachmentOwnerKind.Guardian: {
        const guardian = await this.guardianRepository.findById(ownerId)
        if (!guardian || guardian.schoolId !== schoolId) {
          denyResourceAccess()
        }
        return {}
      }
      case AttachmentOwnerKind.StudentHealthProfile: {
        const profile = await this.studentHealthProfileRepository.findById(ownerId)
        if (!profile || profile.schoolId !== schoolId) {
          denyResourceAccess()
        }
        return this.resolveStudentAttachmentResource(profile.studentId, schoolId)
      }
      case AttachmentOwnerKind.StudentClassEnrollment: {
        const enrollment = await this.enrollmentRepository.findById(ownerId)
        if (!enrollment) {
          denyResourceAccess()
        }
        await this.requireStudentInSchool(enrollment.studentId, schoolId)
        const classGroup = await this.requireClassGroupInSchool(enrollment.classGroupId, schoolId, enrollment.academicYearId)
        return { classGroupId: classGroup.id, studentId: enrollment.studentId }
      }
      case AttachmentOwnerKind.AttendanceRecord: {
        const record = await this.attendanceRepository.findById(ownerId)
        if (!record) {
          denyResourceAccess()
        }
        await this.requireStudentInSchool(record.studentId, schoolId)
        const session = await this.requireSessionInSchool(record.sessionId, schoolId)
        return { classGroupId: session.classGroupId, sessionId: session.id, studentId: record.studentId }
      }
      case AttachmentOwnerKind.Incident: {
        const incident = await this.incidentRepository.findById(ownerId)
        if (!incident || incident.schoolId !== schoolId) {
          denyResourceAccess()
        }
        return { classGroupId: incident.classGroupId, sessionId: incident.sessionId }
      }
      case AttachmentOwnerKind.StudentDisciplinaryAction: {
        const action = await this.studentDisciplinaryActionRepository.findById(ownerId)
        if (!action || action.schoolId !== schoolId) {
          denyResourceAccess()
        }
        return this.resolveStudentAttachmentResource(action.studentId, schoolId)
      }
      case AttachmentOwnerKind.AssessmentResult: {
        const result = await this.assessmentResultRepository.findById(ownerId)
        if (!result) {
          denyResourceAccess()
        }
        return this.resolveStudentAttachmentResource(result.studentId, schoolId)
      }
      case AttachmentOwnerKind.ReportCard: {
        const result = await this.reportCardResultRepository.findById(ownerId)
        if (!result) {
          denyResourceAccess()
        }
        return this.resolveStudentAttachmentResource(result.studentId, schoolId)
      }
      case AttachmentOwnerKind.Payment: {
        const payment = await this.paymentRepository.findById(ownerId)
        if (!payment) {
          denyResourceAccess()
        }
        const studentFee = await this.studentFeeRepository.findById(payment.studentFeeId)
        if (!studentFee) {
          denyResourceAccess()
        }
        return this.resolveStudentAttachmentResource(studentFee.studentId, schoolId)
      }
      case AttachmentOwnerKind.Other:
        throw new Error('Attachment owner kind other is not supported by the selected public contract')
    }
  }

  private async resolveStudentAttachmentResource(
    studentId: string,
    schoolId: string,
  ): Promise<{ classGroupId?: string, studentId: string }> {
    await this.requireStudentInSchool(studentId, schoolId)
    const activeEnrollment = await this.enrollmentRepository.findActiveByStudent(studentId)
    return { classGroupId: activeEnrollment?.classGroupId, studentId }
  }
}
