import type { ClassSubject } from '../../entities/academics/class-subject'
import type { ClassSubjectMatter } from '../../entities/academics/class-subject-matter'
import type { ClassSubjectProgress } from '../../entities/academics/class-subject-progress'
import type { Subject } from '../../entities/academics/subject'
import type { SubjectMatter } from '../../entities/academics/subject-matter'
import type { Assessment } from '../../entities/assessments/assessment'
import type { AssessmentResult } from '../../entities/assessments/assessment-result'
import type { ReportCardDefinition } from '../../entities/assessments/report-card-definition'
import type { ReportCardResult } from '../../entities/assessments/report-card-result'
import type { Fee } from '../../entities/finances/fee'
import type { Payment } from '../../entities/finances/payment'
import type { StudentFee, StudentFeeSummary } from '../../entities/finances/student-fee'
import type { Announcement } from '../../entities/messaging/announcement'
import type { AnnouncementTarget } from '../../entities/messaging/announcement-target'
import type { MessageDelivery } from '../../entities/messaging/message-delivery'
import type { AttendanceRecord } from '../../entities/scheduling/attendance-record'
import type { CalendarEvent } from '../../entities/scheduling/calendar-event'
import type { Session } from '../../entities/scheduling/session'
import type { AcademicPeriod } from '../../entities/school/academic-period'
import type { AcademicYear } from '../../entities/school/academic-year'
import type { Attachment } from '../../entities/school/attachment'
import type { ClassGroup } from '../../entities/school/class-group'
import type { GradeLevel } from '../../entities/school/grade-level'
import type { GradeScale } from '../../entities/school/grade-scale'
import type { Resource } from '../../entities/school/resource'
import type { ResourceAssignment } from '../../entities/school/resource-assignment'
import type { School } from '../../entities/school/school'
import type { StaffMember } from '../../entities/school/staff-member'
import type { DisciplinaryAction } from '../../entities/students/disciplinary-action'
import type { Guardian } from '../../entities/students/guardian'
import type { GuardianStudentLink } from '../../entities/students/guardian-student-link'
import type { Incident } from '../../entities/students/incident'
import type { Student } from '../../entities/students/student'
import type { StudentClassEnrollment } from '../../entities/students/student-class-enrollment'
import type { StudentDisciplinaryAction } from '../../entities/students/student-disciplinary-action'
import type { StudentHealthProfile } from '../../entities/students/student-health-profile'
import type { StudentIncidentInvolvement } from '../../entities/students/student-incident-involvement'
import type { StudentNote } from '../../entities/students/student-note'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { AttendanceSummary } from '../../value_object/attendance-summary'
import type { AuthorizationAction, AuthorizedServiceArgs } from '../authorization'
import type { ServiceArgs } from '../school-headless-app'
import { ReportCardResultStatus } from '../../entities/assessments/report-card-result'
import { buildStudentFeeSummary, FeeStatus } from '../../entities/finances/student-fee'
import { MessageDeliveryStatus } from '../../entities/messaging/message-delivery'
import { AttendanceJustificationStatus, AttendanceStatus } from '../../entities/scheduling/attendance-record'
import { CalendarEventScopeKind } from '../../entities/scheduling/calendar-event'
import { AttachmentOwnerKind } from '../../entities/school/attachment'
import { AttendanceMode } from '../../entities/school/class-group'
import { StaffRole } from '../../entities/school/staff-member'
import { StudentClassEnrollmentStatus } from '../../entities/students/student-class-enrollment'
import { StudentNoteVisibility } from '../../entities/students/student-note'
import { isSameDate } from '../../entities/utils'
import { AttendanceSummary as AttendanceSummaryValue } from '../../value_object/attendance-summary'
import { AuthorizationError, AuthorizationErrorCode, denyResourceAccess } from '../authorization'

export interface TeacherCourseLoad {
  teacher: StaffMember
  assignedCourseCount: number
}

export interface WorkspaceContext {
  school: School
  activeAcademicYear?: AcademicYear
  academicPeriods: AcademicPeriod[]
  selectedAcademicPeriod?: AcademicPeriod
  gradeLevels: GradeLevel[]
  classGroups: ClassGroup[]
  selectedClassGroup?: ClassGroup
  staffMembers: StaffMember[]
  subjects: Subject[]
  gradeScales: GradeScale[]
  teacherCourseLoads: TeacherCourseLoad[]
}

export interface SchoolOverview {
  school: School
  activeAcademicYear?: AcademicYear
  classCount: number
  studentCount: number
  overdueFeeCount: number
  publishedReportCardCount: number
  recentAnnouncements: Announcement[]
}

export interface StudentDirectoryRow {
  student: Student
  currentEnrollment?: StudentClassEnrollment
  classGroup?: ClassGroup
  guardianCount: number
  balanceDue: number
  latestReportCardResult?: ReportCardResult
}

export interface StudentDirectory {
  school: School
  activeAcademicYear?: AcademicYear
  rows: StudentDirectoryRow[]
}

export interface StudentEnrollmentHistoryRow {
  enrollment: StudentClassEnrollment
  classGroup: ClassGroup
  gradeLevel: GradeLevel
  academicYear: AcademicYear
}

export interface StudentEnrollmentHistory {
  student: Student
  currentEnrollment?: StudentEnrollmentHistoryRow
  history: StudentEnrollmentHistoryRow[]
}

export interface StudentDetailGuardian {
  guardian: Guardian
  link: GuardianStudentLink
}

export interface StudentDetailVisibility {
  includesFinance: boolean
  includesGuardianPreferences: boolean
  includesHealthProfile: boolean
  includesNotes: boolean
  includesPublishedReportCards: boolean
  includesEnrollmentHistory: boolean
}

export interface StudentDetail {
  student: Student
  currentEnrollment?: StudentEnrollmentHistoryRow
  enrollmentHistory: StudentEnrollmentHistoryRow[]
  guardians: StudentDetailGuardian[]
  attendanceSummary: AttendanceSummary
  financeSummary?: StudentFeeSummary
  publishedReportCards: ReportCardResult[]
  healthProfile?: StudentHealthProfile
  notes: StudentNote[]
  visibility: StudentDetailVisibility
}

export interface IncidentDisciplinaryActionDetail {
  studentDisciplinaryAction: StudentDisciplinaryAction
  disciplinaryAction: DisciplinaryAction
}

export interface IncidentInvolvementDetail {
  involvement: StudentIncidentInvolvement
  student: Student
  actions: IncidentDisciplinaryActionDetail[]
}

export interface IncidentDetail {
  incident: Incident
  reporter?: StaffMember
  classGroup?: ClassGroup
  session?: Session
  involvements: IncidentInvolvementDetail[]
}

export interface StudentIncidentSummary {
  incident: Incident
  involvement: StudentIncidentInvolvement
  actions: IncidentDisciplinaryActionDetail[]
}

export interface StudentIncidentDirectory {
  student: Student
  rows: StudentIncidentSummary[]
}

export interface ReportCardDetailAssessmentResult {
  assessment: Assessment
  result: AssessmentResult
}

export interface ReportCardDetail {
  reportCard: ReportCardResult
  student: Student
  classGroup: ClassGroup
  period: AcademicPeriod
  definition: ReportCardDefinition
  assessmentResults: ReportCardDetailAssessmentResult[]
}

export interface AssessmentEntryReviewRow {
  student: Student
  result?: AssessmentResult
  isLockedByPublishedReportCard: boolean
}

export interface AssessmentEntryReview {
  assessment: Assessment
  classGroup: ClassGroup
  classSubject: ClassSubject
  subject: Subject
  period: AcademicPeriod
  rows: AssessmentEntryReviewRow[]
}

export interface AnnouncementDeliverySummary {
  total: number
  pending: number
  sent: number
  failed: number
  read: number
  cancelled: number
}

export interface AnnouncementDetail {
  announcement: Announcement
  targets: AnnouncementTarget[]
  deliveries: MessageDelivery[]
  deliverySummary: AnnouncementDeliverySummary
}

export interface AnnouncementDirectory {
  rows: AnnouncementDetail[]
}

export interface AcademicCalendar {
  academicYear: AcademicYear
  classGroup?: ClassGroup
  events: CalendarEvent[]
}

export interface ResourceAssignmentDetail {
  assignment: ResourceAssignment
  resource: Resource
  classGroup?: ClassGroup
  session?: Session
}

export interface ResourceDirectory {
  resources: Resource[]
  assignments: ResourceAssignmentDetail[]
}

export interface AttachmentDirectory {
  attachments: Attachment[]
}

export interface CurriculumProgressHistoryEntry {
  progress: ClassSubjectProgress
  session: Session
}

export interface CurriculumMatterProgressDetail {
  classSubjectMatter: ClassSubjectMatter
  subjectMatter: SubjectMatter
  history: CurriculumProgressHistoryEntry[]
}

export interface ClassSubjectProgressDetail {
  classGroup: ClassGroup
  classSubject: ClassSubject
  subject: Subject
  teacher?: StaffMember
  matters: CurriculumMatterProgressDetail[]
}

export interface FinanceLedgerItem {
  studentFee: StudentFee
  fee: Fee
  payments: Payment[]
}

export interface FinanceLedger {
  student: Student
  academicYearId?: string
  items: FinanceLedgerItem[]
  summary: StudentFeeSummary
}

export interface ClassGroupCourseAssignment {
  classSubject: ClassSubject
  subject: Subject
  teacher?: StaffMember
  teacherName: string
}

export interface ClassGroupTimetableEntry {
  session: Session
  courseName: string
  teacherName: string
  roomName: string
}

export interface ClassGroupOverviewRow {
  classGroup: ClassGroup
  studentCount: number
  courseCount: number
  teacherNames: string[]
}

export interface ClassGroupDirectory {
  activeAcademicYear?: AcademicYear
  rows: ClassGroupOverviewRow[]
}

export interface AttendanceSessionOption {
  session: Session
  label: string
}

export interface AttendanceReviewRow {
  student: Student
  record?: AttendanceRecord
  status: AttendanceStatus
}

export interface AttendanceReviewSummary {
  present: number
  absent: number
  excusedAbsent: number
  late: number
  total: number
}

export interface AttendanceReview {
  classGroup?: ClassGroup
  availableSessions: AttendanceSessionOption[]
  selectedSession?: Session
  selectedDate: Date
  rows: AttendanceReviewRow[]
  summary: AttendanceReviewSummary
}

///

export class WorkspaceService {
  constructor(args: ServiceArgs) {
    this.schools = args.repositories.schools
    this.academicYears = args.repositories.academicYears
    this.academicPeriods = args.repositories.academicPeriods
    this.gradeLevels = args.repositories.gradeLevels
    this.classGroups = args.repositories.classGroups
    this.staffMembers = args.repositories.staffMembers
    this.subjects = args.repositories.subjects
    this.gradeScales = args.repositories.gradeScales
    this.classSubjects = args.repositories.classSubjects
    this.staffAssignments = args.repositories.staffAssignments
  }

  private readonly schools: SchoolRepositories['schools']
  private readonly academicYears: SchoolRepositories['academicYears']
  private readonly academicPeriods: SchoolRepositories['academicPeriods']
  private readonly gradeLevels: SchoolRepositories['gradeLevels']
  private readonly classGroups: SchoolRepositories['classGroups']
  private readonly staffMembers: SchoolRepositories['staffMembers']
  private readonly subjects: SchoolRepositories['subjects']
  private readonly gradeScales: SchoolRepositories['gradeScales']
  private readonly classSubjects: SchoolRepositories['classSubjects']
  private readonly staffAssignments: SchoolRepositories['staffAssignments']

  async getWorkspaceContext({
    schoolId,
    classGroupId,
  }: {
    schoolId: string
    classGroupId?: string
  }): Promise<WorkspaceContext> {
    const school = await this.requireSchool(schoolId)
    const activeAcademicYear = await this.findActiveAcademicYear(schoolId)
    const [classGroups, academicPeriods, gradeLevels, staffMembers, subjects, gradeScales] = await Promise.all([
      activeAcademicYear ? this.classGroups.list({ academicYearId: activeAcademicYear.id }) : [],
      activeAcademicYear ? this.academicPeriods.list({ academicYearId: activeAcademicYear.id }) : [],
      this.gradeLevels.list({ schoolId }),
      this.staffMembers.list({ schoolId }),
      this.subjects.list({ schoolId }),
      this.gradeScales.list({ schoolId }),
    ])
    classGroups.sort((left, right) => left.name.localeCompare(right.name))
    academicPeriods.sort((left, right) => left.startDate.getTime() - right.startDate.getTime())
    gradeLevels.sort((left, right) => left.order - right.order || left.name.localeCompare(right.name))
    staffMembers.sort((left, right) => left.fullName.localeCompare(right.fullName))
    subjects.sort((left, right) => left.name.localeCompare(right.name))
    gradeScales.sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || left.name.localeCompare(right.name))
    const selectedClassGroup
      = (classGroupId ? classGroups.find(candidate => candidate.id === classGroupId) : undefined)
        ?? classGroups[0]
    const selectedAcademicPeriod = academicPeriods[0]
    const teacherCourseLoads = await this.buildTeacherCourseLoads({
      classGroups,
      staffMembers,
    })

    return {
      school,
      activeAcademicYear,
      academicPeriods,
      selectedAcademicPeriod,
      gradeLevels,
      classGroups,
      selectedClassGroup,
      staffMembers,
      subjects,
      gradeScales,
      teacherCourseLoads,
    }
  }

  private async buildTeacherCourseLoads({
    classGroups,
    staffMembers,
  }: {
    classGroups: readonly ClassGroup[]
    staffMembers: readonly StaffMember[]
  }): Promise<TeacherCourseLoad[]> {
    const teacherIdsToCourseCount = new Map<string, number>()

    for (const classGroup of classGroups) {
      const classSubjects = await this.classSubjects.list({ classGroupId: classGroup.id })

      for (const classSubject of classSubjects) {
        const teacherId = await this.resolveTeacherId(classSubject.id)
        if (!teacherId) {
          continue
        }
        teacherIdsToCourseCount.set(teacherId, (teacherIdsToCourseCount.get(teacherId) ?? 0) + 1)
      }
    }

    return staffMembers
      .filter(staffMember => staffMember.hasRole(StaffRole.Teacher))
      .map(teacher => ({
        teacher,
        assignedCourseCount: teacherIdsToCourseCount.get(teacher.id) ?? 0,
      }))
  }

  private async resolveTeacherId(classSubjectId: string): Promise<string | undefined> {
    const assignments = await this.staffAssignments.list({ classSubjectId })
    const teacherAssignment = assignments.find(assignment => assignment.role === StaffRole.Teacher)
    return teacherAssignment?.staffId
  }

  private async requireSchool(schoolId: string): Promise<School> {
    const school = await this.schools.findById(schoolId)
    if (!school) {
      throw new Error(`Unknown school: ${schoolId}`)
    }
    return school
  }

  private async findActiveAcademicYear(schoolId: string): Promise<AcademicYear | undefined> {
    const academicYears = await this.academicYears.list({ schoolId })
    return academicYears.find(academicYear => academicYear.isActive) ?? academicYears[0]
  }
}

export class SchoolOverviewService {
  constructor(args: ServiceArgs) {
    this.schools = args.repositories.schools
    this.academicYears = args.repositories.academicYears
    this.classGroups = args.repositories.classGroups
    this.students = args.repositories.students
    this.announcements = args.repositories.announcements
    this.fees = args.repositories.studentFees
    this.reportCardResults = args.repositories.results
  }

  private readonly schools: SchoolRepositories['schools']
  private readonly academicYears: SchoolRepositories['academicYears']
  private readonly classGroups: SchoolRepositories['classGroups']
  private readonly students: SchoolRepositories['students']
  private readonly announcements: SchoolRepositories['announcements']
  private readonly fees: SchoolRepositories['studentFees']
  private readonly reportCardResults: SchoolRepositories['results']

  async getSchoolOverview({ schoolId }: { schoolId: string }): Promise<SchoolOverview> {
    const school = await this.requireSchool(schoolId)
    const activeAcademicYear = await this.findActiveAcademicYear(schoolId)
    const [classGroups, students, announcements] = await Promise.all([
      activeAcademicYear ? this.classGroups.list({ academicYearId: activeAcademicYear.id }) : [],
      this.students.list({ schoolId }),
      this.announcements.list({ schoolId }),
    ])

    let overdueFeeCount = 0
    let publishedReportCardCount = 0

    for (const student of students) {
      const [fees, reportCardResults] = await Promise.all([
        this.fees.list({ studentId: student.id }),
        this.reportCardResults.list({ studentId: student.id }),
      ])
      overdueFeeCount += fees.filter(fee => fee.status === FeeStatus.Overdue).length
      publishedReportCardCount += reportCardResults.filter(
        reportCardResult => reportCardResult.status === ReportCardResultStatus.Published,
      ).length
    }

    return {
      school,
      activeAcademicYear,
      classCount: classGroups.length,
      studentCount: students.length,
      overdueFeeCount,
      publishedReportCardCount,
      recentAnnouncements: announcements
        .slice()
        .sort((left, right) => {
          const leftDate = left.publishedAt ?? left.createdAt
          const rightDate = right.publishedAt ?? right.createdAt
          return rightDate.getTime() - leftDate.getTime()
        })
        .slice(0, 4),
    }
  }

  private async requireSchool(schoolId: string): Promise<School> {
    const school = await this.schools.findById(schoolId)
    if (!school) {
      throw new Error(`Unknown school: ${schoolId}`)
    }
    return school
  }

  private async findActiveAcademicYear(schoolId: string): Promise<AcademicYear | undefined> {
    const academicYears = await this.academicYears.list({ schoolId })
    return academicYears.find(academicYear => academicYear.isActive) ?? academicYears[0]
  }
}

export class StudentDirectoryService {
  constructor(args: ServiceArgs) {
    this.schools = args.repositories.schools
    this.academicYears = args.repositories.academicYears
    this.classGroups = args.repositories.classGroups
    this.students = args.repositories.students
    this.enrollments = args.repositories.enrollments
    this.guardianStudentLinks = args.repositories.guardianLinks
    this.reportCardResults = args.repositories.results
    this.fees = args.repositories.studentFees
  }

  private readonly schools: SchoolRepositories['schools']
  private readonly academicYears: SchoolRepositories['academicYears']
  private readonly classGroups: SchoolRepositories['classGroups']
  private readonly students: SchoolRepositories['students']
  private readonly enrollments: SchoolRepositories['enrollments']
  private readonly guardianStudentLinks: SchoolRepositories['guardianLinks']
  private readonly reportCardResults: SchoolRepositories['results']
  private readonly fees: SchoolRepositories['studentFees']

  async listStudents({
    schoolId,
    academicYearId,
  }: {
    schoolId: string
    academicYearId?: string
  }): Promise<StudentDirectory> {
    const school = await this.requireSchool(schoolId)
    const activeAcademicYear = await this.resolveAcademicYear({ schoolId, academicYearId })
    const classGroups = activeAcademicYear
      ? await this.classGroups.list({ academicYearId: activeAcademicYear.id })
      : []
    const classGroupById = new Map(classGroups.map(classGroup => [classGroup.id, classGroup]))
    const students = (await this.students.list({ schoolId }))
      .sort((left, right) =>
        left.lastName.localeCompare(right.lastName)
        || left.firstName.localeCompare(right.firstName)
        || left.id.localeCompare(right.id))

    const rows = await Promise.all(
      students.map(async (student) => {
        const [currentEnrollment, guardianLinks, reportCardResults, fees] = await Promise.all([
          this.enrollments.findActiveByStudent(student.id).then(enrollment =>
            enrollment && classGroupById.has(enrollment.classGroupId) ? enrollment : undefined,
          ),
          this.guardianStudentLinks.list({ studentId: student.id }),
          this.reportCardResults.list({ studentId: student.id }),
          this.fees.list({ studentId: student.id }),
        ])

        return {
          student,
          currentEnrollment,
          classGroup: currentEnrollment ? classGroupById.get(currentEnrollment.classGroupId) : undefined,
          guardianCount: guardianLinks.length,
          balanceDue: fees
            .filter(fee => fee.status !== FeeStatus.Cancelled)
            .reduce((sum, fee) => sum + fee.balanceDue.amount, 0),
          latestReportCardResult: this.pickLatestReportCardResult(reportCardResults),
        }
      }),
    )

    return {
      school,
      activeAcademicYear,
      rows,
    }
  }

  private pickLatestReportCardResult(reportCardResults: readonly ReportCardResult[]): ReportCardResult | undefined {
    return reportCardResults
      .slice()
      .sort((left, right) => {
        const leftDate = left.publishedAt ?? left.generatedAt
        const rightDate = right.publishedAt ?? right.generatedAt
        return rightDate.getTime() - leftDate.getTime()
      })[0]
  }

  private async requireSchool(schoolId: string): Promise<School> {
    const school = await this.schools.findById(schoolId)
    if (!school) {
      throw new Error(`Unknown school: ${schoolId}`)
    }
    return school
  }

  private async resolveAcademicYear({
    schoolId,
    academicYearId,
  }: {
    schoolId: string
    academicYearId?: string
  }): Promise<AcademicYear | undefined> {
    if (!academicYearId) {
      const academicYears = await this.academicYears.list({ schoolId })
      return academicYears.find(academicYear => academicYear.isActive) ?? academicYears[0]
    }

    const academicYear = await this.academicYears.findById(academicYearId)
    if (!academicYear || academicYear.schoolId !== schoolId) {
      throw new Error(`Academic year ${academicYearId} does not belong to school ${schoolId}`)
    }
    return academicYear
  }
}

export class CommunicationsReadService {
  constructor(args: ServiceArgs) {
    this.announcements = args.repositories.announcements
    this.targets = args.repositories.announcementTargets
    this.deliveries = args.repositories.messageDeliveries
  }

  private readonly announcements: SchoolRepositories['announcements']
  private readonly targets: SchoolRepositories['announcementTargets']
  private readonly deliveries: SchoolRepositories['messageDeliveries']

  async listAnnouncements({ schoolId }: { schoolId: string }): Promise<AnnouncementDirectory> {
    const announcements = (await this.announcements.list({ schoolId }))
      .sort((left, right) => {
        const leftDate = left.publishedAt ?? left.createdAt
        const rightDate = right.publishedAt ?? right.createdAt
        return rightDate.getTime() - leftDate.getTime() || left.id.localeCompare(right.id)
      })
    return { rows: await Promise.all(announcements.map(announcement => this.buildDetail(announcement))) }
  }

  async getAnnouncementDetail({
    schoolId,
    announcementId,
  }: {
    schoolId: string
    announcementId: string
  }): Promise<AnnouncementDetail> {
    const announcement = await this.announcements.findById(announcementId)
    if (!announcement || announcement.schoolId !== schoolId) {
      denyResourceAccess()
    }
    return this.buildDetail(announcement)
  }

  private async buildDetail(announcement: Announcement): Promise<AnnouncementDetail> {
    const [targets, deliveries] = await Promise.all([
      this.targets.list({ announcementId: announcement.id }),
      this.deliveries.list({ announcementId: announcement.id }),
    ])
    targets.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
    deliveries.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
    return {
      announcement,
      targets,
      deliveries,
      deliverySummary: deliveries.reduce<AnnouncementDeliverySummary>((summary, delivery) => {
        summary.total += 1
        switch (delivery.status) {
          case MessageDeliveryStatus.Pending:
            summary.pending += 1
            break
          case MessageDeliveryStatus.Sent:
            summary.sent += 1
            break
          case MessageDeliveryStatus.Failed:
            summary.failed += 1
            break
          case MessageDeliveryStatus.Read:
            summary.read += 1
            break
          case MessageDeliveryStatus.Cancelled:
            summary.cancelled += 1
            break
        }
        return summary
      }, { total: 0, pending: 0, sent: 0, failed: 0, read: 0, cancelled: 0 }),
    }
  }
}

export class CalendarReadService {
  constructor(args: ServiceArgs) {
    this.academicYears = args.repositories.academicYears
    this.classGroups = args.repositories.classGroups
    this.calendarEvents = args.repositories.calendarEvents
  }

  private readonly academicYears: SchoolRepositories['academicYears']
  private readonly classGroups: SchoolRepositories['classGroups']
  private readonly calendarEvents: SchoolRepositories['calendarEvents']

  async getCalendarEvents({
    schoolId,
    academicYearId,
    classGroupId,
  }: {
    schoolId: string
    academicYearId: string
    classGroupId?: string
  }): Promise<AcademicCalendar> {
    const academicYear = await this.academicYears.findById(academicYearId)
    const classGroup = classGroupId ? await this.classGroups.findById(classGroupId) : undefined
    if (
      !academicYear
      || academicYear.schoolId !== schoolId
      || (classGroupId !== undefined && (
        !classGroup
        || classGroup.schoolId !== schoolId
        || classGroup.academicYearId !== academicYear.id
      ))
    ) {
      denyResourceAccess()
    }
    const events = (await this.calendarEvents.list({ schoolId, academicYearId }))
      .filter(event =>
        !classGroup
        || event.scopeKind === CalendarEventScopeKind.School
        || (event.scopeKind === CalendarEventScopeKind.GradeLevel && event.scopeId === classGroup.gradeLevelId)
        || (event.scopeKind === CalendarEventScopeKind.ClassGroup && event.scopeId === classGroup.id))
      .sort((left, right) =>
        left.startDate.getTime() - right.startDate.getTime()
        || left.endDate.getTime() - right.endDate.getTime()
        || left.title.localeCompare(right.title)
        || left.id.localeCompare(right.id))
    return { academicYear, classGroup, events }
  }
}

export class ResourceReadService {
  constructor(args: ServiceArgs) {
    this.resources = args.repositories.resources
    this.resourceAssignments = args.repositories.resourceAssignments
    this.classGroups = args.repositories.classGroups
    this.sessions = args.repositories.sessions
  }

  private readonly resources: SchoolRepositories['resources']
  private readonly resourceAssignments: SchoolRepositories['resourceAssignments']
  private readonly classGroups: SchoolRepositories['classGroups']
  private readonly sessions: SchoolRepositories['sessions']

  async listResources({ schoolId }: { schoolId: string }): Promise<ResourceDirectory> {
    const resources = (await this.resources.list({ schoolId }))
      .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id))
    const resourceIds = new Set(resources.map(resource => resource.id))
    const assignments = (await this.resourceAssignments.list())
      .filter(assignment => resourceIds.has(assignment.resourceId))
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
    return {
      resources,
      assignments: await Promise.all(assignments.map(assignment => this.buildAssignmentDetail(assignment))),
    }
  }

  private async buildAssignmentDetail(assignment: ResourceAssignment): Promise<ResourceAssignmentDetail> {
    const resource = await this.resources.findById(assignment.resourceId)
    if (!resource) {
      denyResourceAccess()
    }
    const classGroup = assignment.classGroupId
      ? await this.classGroups.findById(assignment.classGroupId)
      : undefined
    const session = assignment.sessionId
      ? await this.sessions.findById(assignment.sessionId)
      : undefined
    if ((assignment.classGroupId && (!classGroup || classGroup.schoolId !== resource.schoolId)) || (assignment.sessionId && !session)) {
      denyResourceAccess()
    }
    const sessionClassGroup = session ? await this.classGroups.findById(session.classGroupId) : undefined
    if (session && (!sessionClassGroup || sessionClassGroup.schoolId !== resource.schoolId)) {
      denyResourceAccess()
    }
    return { assignment, resource, classGroup: classGroup ?? sessionClassGroup, session }
  }
}

export class AttachmentReadService {
  constructor(args: ServiceArgs) {
    this.attachments = args.repositories.attachments
    this.attendance = args.repositories.attendance
    this.enrollments = args.repositories.enrollments
    this.guardians = args.repositories.guardians
    this.incidents = args.repositories.incidents
    this.payments = args.repositories.payments
    this.results = args.repositories.results
    this.assessmentResults = args.repositories.assessmentResults
    this.studentFees = args.repositories.studentFees
    this.students = args.repositories.students
    this.studentDisciplinaryActions = args.repositories.studentDisciplinaryActions
    this.studentHealthProfiles = args.repositories.studentHealthProfiles
  }

  private readonly attachments: SchoolRepositories['attachments']
  private readonly attendance: SchoolRepositories['attendance']
  private readonly enrollments: SchoolRepositories['enrollments']
  private readonly guardians: SchoolRepositories['guardians']
  private readonly incidents: SchoolRepositories['incidents']
  private readonly payments: SchoolRepositories['payments']
  private readonly results: SchoolRepositories['results']
  private readonly assessmentResults: SchoolRepositories['assessmentResults']
  private readonly studentFees: SchoolRepositories['studentFees']
  private readonly students: SchoolRepositories['students']
  private readonly studentDisciplinaryActions: SchoolRepositories['studentDisciplinaryActions']
  private readonly studentHealthProfiles: SchoolRepositories['studentHealthProfiles']

  async listAttachments({
    schoolId,
    ownerKind,
    ownerId,
  }: {
    schoolId: string
    ownerKind: AttachmentOwnerKind
    ownerId: string
  }): Promise<AttachmentDirectory> {
    const context = await this.resolveOwnerContext(ownerKind, ownerId)
    if (context.schoolId !== schoolId) {
      denyResourceAccess()
    }
    const attachments = (await this.attachments.list({ schoolId, ownerKind, ownerId }))
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
    return { attachments }
  }

  private async resolveOwnerContext(
    ownerKind: AttachmentOwnerKind,
    ownerId: string,
  ): Promise<{ schoolId: string, studentId?: string }> {
    switch (ownerKind) {
      case AttachmentOwnerKind.Student:
        return this.resolveStudentOwner(ownerId)
      case AttachmentOwnerKind.Guardian: {
        const guardian = await this.guardians.findById(ownerId)
        if (!guardian) {
          denyResourceAccess()
        }
        return { schoolId: guardian.schoolId }
      }
      case AttachmentOwnerKind.StudentHealthProfile: {
        const profile = await this.studentHealthProfiles.findById(ownerId)
        if (!profile) {
          denyResourceAccess()
        }
        return { schoolId: profile.schoolId, studentId: profile.studentId }
      }
      case AttachmentOwnerKind.StudentClassEnrollment: {
        const enrollment = await this.enrollments.findById(ownerId)
        if (!enrollment) {
          denyResourceAccess()
        }
        return this.resolveStudentOwner(enrollment.studentId)
      }
      case AttachmentOwnerKind.AttendanceRecord: {
        const record = await this.attendance.findById(ownerId)
        if (!record) {
          denyResourceAccess()
        }
        return this.resolveStudentOwner(record.studentId)
      }
      case AttachmentOwnerKind.Incident: {
        const incident = await this.incidents.findById(ownerId)
        if (!incident) {
          denyResourceAccess()
        }
        return { schoolId: incident.schoolId }
      }
      case AttachmentOwnerKind.StudentDisciplinaryAction: {
        const action = await this.studentDisciplinaryActions.findById(ownerId)
        if (!action) {
          denyResourceAccess()
        }
        return this.resolveStudentOwner(action.studentId)
      }
      case AttachmentOwnerKind.AssessmentResult: {
        const result = await this.assessmentResults.findById(ownerId)
        if (!result) {
          denyResourceAccess()
        }
        return this.resolveStudentOwner(result.studentId)
      }
      case AttachmentOwnerKind.ReportCard: {
        const result = await this.results.findById(ownerId)
        if (!result) {
          denyResourceAccess()
        }
        return this.resolveStudentOwner(result.studentId)
      }
      case AttachmentOwnerKind.Payment: {
        const payment = await this.payments.findById(ownerId)
        if (!payment) {
          denyResourceAccess()
        }
        const studentFee = await this.studentFees.findById(payment.studentFeeId)
        if (!studentFee) {
          denyResourceAccess()
        }
        return this.resolveStudentOwner(studentFee.studentId)
      }
      case AttachmentOwnerKind.Other:
        throw new Error('Attachment owner kind other is not supported by the selected public contract')
    }
  }

  private async resolveStudentOwner(studentId: string): Promise<{ schoolId: string, studentId: string }> {
    const student = await this.students.findById(studentId)
    if (!student) {
      denyResourceAccess()
    }
    return { schoolId: student.schoolId, studentId: student.id }
  }
}

export class CurriculumProgressReadService {
  constructor(args: ServiceArgs) {
    this.classGroups = args.repositories.classGroups
    this.classSubjects = args.repositories.classSubjects
    this.subjects = args.repositories.subjects
    this.classSubjectMatters = args.repositories.classSubjectMatters
    this.subjectMatters = args.repositories.subjectMatters
    this.classSubjectProgress = args.repositories.classSubjectProgress
    this.sessions = args.repositories.sessions
    this.staffAssignments = args.repositories.staffAssignments
    this.staffMembers = args.repositories.staffMembers
  }

  private readonly classGroups: SchoolRepositories['classGroups']
  private readonly classSubjects: SchoolRepositories['classSubjects']
  private readonly subjects: SchoolRepositories['subjects']
  private readonly classSubjectMatters: SchoolRepositories['classSubjectMatters']
  private readonly subjectMatters: SchoolRepositories['subjectMatters']
  private readonly classSubjectProgress: SchoolRepositories['classSubjectProgress']
  private readonly sessions: SchoolRepositories['sessions']
  private readonly staffAssignments: SchoolRepositories['staffAssignments']
  private readonly staffMembers: SchoolRepositories['staffMembers']

  async getClassSubjectProgressDetail({
    schoolId,
    classSubjectId,
  }: {
    schoolId: string
    classSubjectId: string
  }): Promise<ClassSubjectProgressDetail> {
    const classSubject = await this.classSubjects.findById(classSubjectId)
    const [classGroup, subject] = classSubject
      ? await Promise.all([
          this.classGroups.findById(classSubject.classGroupId),
          this.subjects.findById(classSubject.subjectId),
        ])
      : []
    if (
      !classSubject
      || !classGroup
      || !subject
      || classGroup.schoolId !== schoolId
      || subject.schoolId !== schoolId
    ) {
      denyResourceAccess()
    }

    const [teacher, assignedMatters] = await Promise.all([
      this.resolveTeacher(classSubject.id, schoolId),
      this.classSubjectMatters.list({ classSubjectId: classSubject.id }),
    ])
    const matters = await Promise.all(
      assignedMatters.map(async (classSubjectMatter) => {
        const subjectMatter = await this.subjectMatters.findById(classSubjectMatter.subjectMatterId)
        if (!subjectMatter || subjectMatter.subjectId !== subject.id) {
          denyResourceAccess()
        }
        const progressRecords = await this.classSubjectProgress.list({ classSubjectMatterId: classSubjectMatter.id })
        const history = await Promise.all(
          progressRecords.map(async (progress) => {
            const session = await this.sessions.findById(progress.sessionId)
            if (
              !session
              || session.classGroupId !== classGroup.id
              || session.classSubjectId !== classSubject.id
            ) {
              denyResourceAccess()
            }
            return { progress, session }
          }),
        )
        history.sort((left, right) =>
          left.session.startsAt.getTime() - right.session.startsAt.getTime()
          || left.progress.recordedAt.getTime() - right.progress.recordedAt.getTime()
          || left.session.id.localeCompare(right.session.id)
          || left.progress.id.localeCompare(right.progress.id))
        return { classSubjectMatter, subjectMatter, history }
      }),
    )
    matters.sort((left, right) =>
      left.subjectMatter.sequenceOrder - right.subjectMatter.sequenceOrder
      || left.subjectMatter.name.localeCompare(right.subjectMatter.name)
      || left.subjectMatter.id.localeCompare(right.subjectMatter.id))

    return { classGroup, classSubject, subject, teacher, matters }
  }

  private async resolveTeacher(classSubjectId: string, schoolId: string): Promise<StaffMember | undefined> {
    const assignments = await this.staffAssignments.list({ classSubjectId })
    const teacherAssignment = assignments.find(assignment => assignment.role === StaffRole.Teacher)
    if (!teacherAssignment) {
      return undefined
    }
    const teacher = await this.staffMembers.findById(teacherAssignment.staffId)
    if (!teacher || teacher.schoolId !== schoolId) {
      denyResourceAccess()
    }
    return teacher
  }
}

export class FinanceLedgerService {
  constructor(args: ServiceArgs) {
    this.students = args.repositories.students
    this.fees = args.repositories.fees
    this.studentFees = args.repositories.studentFees
    this.payments = args.repositories.payments
  }

  private readonly students: SchoolRepositories['students']
  private readonly fees: SchoolRepositories['fees']
  private readonly studentFees: SchoolRepositories['studentFees']
  private readonly payments: SchoolRepositories['payments']

  async getFinanceLedger({
    schoolId,
    studentId,
    academicYearId,
  }: {
    schoolId: string
    studentId: string
    academicYearId?: string
  }): Promise<FinanceLedger> {
    const student = await this.students.findById(studentId)
    if (!student || student.schoolId !== schoolId) {
      denyResourceAccess()
    }

    const studentFees = (await this.studentFees.list({ studentId }))
      .filter(studentFee => !academicYearId || studentFee.academicYearId === academicYearId)
      .sort((left, right) => {
        const leftDueDate = left.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER
        const rightDueDate = right.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER
        return leftDueDate - rightDueDate || left.id.localeCompare(right.id)
      })

    const items = await Promise.all(studentFees.map(async (studentFee) => {
      const fee = await this.fees.findById(studentFee.feeId)
      if (!fee || fee.schoolId !== schoolId || fee.academicYearId !== studentFee.academicYearId) {
        denyResourceAccess()
      }
      const payments = (await this.payments.list({ studentFeeId: studentFee.id }))
        .sort((left, right) => right.paymentDate.getTime() - left.paymentDate.getTime() || left.id.localeCompare(right.id))
      return { studentFee, fee, payments }
    }))

    return {
      student,
      academicYearId,
      items,
      summary: buildStudentFeeSummary(studentFees),
    }
  }
}

export class StudentEnrollmentHistoryService {
  constructor(args: ServiceArgs) {
    this.students = args.repositories.students
    this.enrollments = args.repositories.enrollments
    this.classGroups = args.repositories.classGroups
    this.gradeLevels = args.repositories.gradeLevels
    this.academicYears = args.repositories.academicYears
  }

  private readonly students: SchoolRepositories['students']
  private readonly enrollments: SchoolRepositories['enrollments']
  private readonly classGroups: SchoolRepositories['classGroups']
  private readonly gradeLevels: SchoolRepositories['gradeLevels']
  private readonly academicYears: SchoolRepositories['academicYears']

  async getStudentEnrollmentHistory({
    schoolId,
    studentId,
  }: {
    schoolId: string
    studentId: string
  }): Promise<StudentEnrollmentHistory> {
    const student = await this.students.findById(studentId)
    if (!student || student.schoolId !== schoolId) {
      denyResourceAccess()
    }
    const enrollments = (await this.enrollments.list({ studentId }))
      .sort((left, right) =>
        left.enrollmentIndex - right.enrollmentIndex
        || left.enrolledAt.getTime() - right.enrolledAt.getTime()
        || left.id.localeCompare(right.id))
    const history = await Promise.all(enrollments.map(enrollment => this.resolveEnrollment(enrollment, schoolId)))

    return {
      student,
      currentEnrollment: history.find(row => row.enrollment.status === StudentClassEnrollmentStatus.Active),
      history,
    }
  }

  private async resolveEnrollment(enrollment: StudentClassEnrollment, schoolId: string): Promise<StudentEnrollmentHistoryRow> {
    const [classGroup, academicYear] = await Promise.all([
      this.classGroups.findById(enrollment.classGroupId),
      this.academicYears.findById(enrollment.academicYearId),
    ])
    const gradeLevel = classGroup ? await this.gradeLevels.findById(classGroup.gradeLevelId) : undefined
    if (
      !classGroup
      || !gradeLevel
      || !academicYear
      || classGroup.schoolId !== schoolId
      || gradeLevel.schoolId !== schoolId
      || academicYear.schoolId !== schoolId
      || classGroup.academicYearId !== academicYear.id
    ) {
      denyResourceAccess()
    }
    return { enrollment, classGroup, gradeLevel, academicYear }
  }
}

export class StudentDetailService {
  constructor(args: ServiceArgs) {
    this.actor = args.actor
    this.students = args.repositories.students
    this.enrollments = args.repositories.enrollments
    this.classGroups = args.repositories.classGroups
    this.gradeLevels = args.repositories.gradeLevels
    this.academicYears = args.repositories.academicYears
    this.guardians = args.repositories.guardians
    this.guardianLinks = args.repositories.guardianLinks
    this.studentHealthProfiles = args.repositories.studentHealthProfiles
    this.studentNotes = args.repositories.studentNotes
    this.studentFees = args.repositories.studentFees
    this.reportCardResults = args.repositories.results
    this.attendance = args.repositories.attendance
    this.staffMembers = args.repositories.staffMembers
  }

  private readonly actor: AuthorizedServiceArgs['actor']
  private readonly students: SchoolRepositories['students']
  private readonly enrollments: SchoolRepositories['enrollments']
  private readonly classGroups: SchoolRepositories['classGroups']
  private readonly gradeLevels: SchoolRepositories['gradeLevels']
  private readonly academicYears: SchoolRepositories['academicYears']
  private readonly guardians: SchoolRepositories['guardians']
  private readonly guardianLinks: SchoolRepositories['guardianLinks']
  private readonly studentHealthProfiles: SchoolRepositories['studentHealthProfiles']
  private readonly studentNotes: SchoolRepositories['studentNotes']
  private readonly studentFees: SchoolRepositories['studentFees']
  private readonly reportCardResults: SchoolRepositories['results']
  private readonly attendance: SchoolRepositories['attendance']
  private readonly staffMembers: SchoolRepositories['staffMembers']

  async getStudentDetail({
    schoolId,
    studentId,
  }: {
    schoolId: string
    studentId: string
  }): Promise<StudentDetail> {
    const student = await this.students.findById(studentId)
    if (!student || student.schoolId !== schoolId) {
      denyResourceAccess()
    }
    const enrollmentHistory = await this.resolveEnrollmentHistory(studentId, schoolId)
    const currentEnrollment = enrollmentHistory.find(row => row.enrollment.status === StudentClassEnrollmentStatus.Active)
    const visibility = await this.resolveVisibility()
    const [guardians, attendanceSummary, studentFees, reportCards, healthProfile, notes] = await Promise.all([
      this.resolveGuardians(studentId, schoolId, visibility),
      this.buildAttendanceSummary(studentId, schoolId, currentEnrollment?.academicYear),
      this.studentFees.list({ studentId }),
      this.resolvePublishedReportCards(studentId, schoolId),
      visibility.includesHealthProfile ? this.resolveHealthProfile(studentId, schoolId) : undefined,
      visibility.includesNotes ? this.resolveNotes(studentId, schoolId, visibility) : [],
    ])

    return {
      student,
      currentEnrollment,
      enrollmentHistory: visibility.includesEnrollmentHistory ? enrollmentHistory : [],
      guardians,
      attendanceSummary,
      financeSummary: visibility.includesFinance ? buildStudentFeeSummary(studentFees) : undefined,
      publishedReportCards: visibility.includesPublishedReportCards ? reportCards : [],
      healthProfile,
      notes,
      visibility,
    }
  }

  private async resolveEnrollmentHistory(studentId: string, schoolId: string): Promise<StudentEnrollmentHistoryRow[]> {
    const enrollments = (await this.enrollments.list({ studentId }))
      .sort((left, right) =>
        left.enrollmentIndex - right.enrollmentIndex
        || left.enrolledAt.getTime() - right.enrolledAt.getTime()
        || left.id.localeCompare(right.id))
    const rows: StudentEnrollmentHistoryRow[] = []
    for (const enrollment of enrollments) {
      const [classGroup, academicYear] = await Promise.all([
        this.classGroups.findById(enrollment.classGroupId),
        this.academicYears.findById(enrollment.academicYearId),
      ])
      const gradeLevel = classGroup ? await this.gradeLevels.findById(classGroup.gradeLevelId) : undefined
      if (
        !classGroup
        || !academicYear
        || !gradeLevel
        || classGroup.schoolId !== schoolId
        || academicYear.schoolId !== schoolId
        || gradeLevel.schoolId !== schoolId
        || classGroup.academicYearId !== academicYear.id
      ) {
        denyResourceAccess()
      }
      rows.push({ enrollment, classGroup, gradeLevel, academicYear })
    }
    return rows
  }

  private async resolveGuardians(
    studentId: string,
    schoolId: string,
    visibility: StudentDetailVisibility,
  ): Promise<StudentDetailGuardian[]> {
    if (!visibility.includesGuardianPreferences) {
      return []
    }
    const links = (await this.guardianLinks.list({ studentId }))
      .filter(link => link.schoolId === schoolId)
      .filter(link => this.actor.kind !== 'guardian' || link.guardianId === this.actor.guardianId)
    const rows: StudentDetailGuardian[] = []
    for (const link of links) {
      const guardian = await this.guardians.findById(link.guardianId)
      if (!guardian || guardian.schoolId !== schoolId) {
        denyResourceAccess()
      }
      rows.push({ guardian, link })
    }
    rows.sort((left, right) =>
      Number(right.link.isPrimary) - Number(left.link.isPrimary)
      || (left.link.emergencyContactPriority ?? Number.MAX_SAFE_INTEGER)
      - (right.link.emergencyContactPriority ?? Number.MAX_SAFE_INTEGER)
      || left.guardian.lastName.localeCompare(right.guardian.lastName)
      || left.guardian.firstName.localeCompare(right.guardian.firstName)
      || left.guardian.id.localeCompare(right.guardian.id))
    return rows
  }

  private async buildAttendanceSummary(
    studentId: string,
    schoolId: string,
    currentAcademicYear?: AcademicYear,
  ): Promise<AttendanceSummary> {
    const academicYear = currentAcademicYear ?? await this.findActiveAcademicYear(schoolId)
    const records = await this.attendance.list(academicYear
      ? {
          studentId,
          date: { $gte: academicYear.startDate, $lte: academicYear.endDate },
        }
      : { studentId })
    let presentCount = 0
    let absenceCount = 0
    let excusedAbsenceCount = 0
    let lateCount = 0
    for (const record of records) {
      switch (record.status) {
        case AttendanceStatus.Present:
          presentCount += 1
          break
        case AttendanceStatus.Absent:
          absenceCount += 1
          if (record.justificationStatus === AttendanceJustificationStatus.Excused) {
            excusedAbsenceCount += 1
          }
          break
        case AttendanceStatus.Late:
          lateCount += 1
          break
      }
    }
    return new AttendanceSummaryValue({ presentCount, absenceCount, excusedAbsenceCount, lateCount })
  }

  private async resolvePublishedReportCards(studentId: string, schoolId: string): Promise<ReportCardResult[]> {
    const reportCards = (await this.reportCardResults.list({ studentId }))
      .filter(reportCard => reportCard.status === ReportCardResultStatus.Published)
    for (const reportCard of reportCards) {
      const classGroup = await this.classGroups.findById(reportCard.classGroupId)
      if (!classGroup || classGroup.schoolId !== schoolId) {
        denyResourceAccess()
      }
    }
    return reportCards.sort((left, right) => {
      const leftDate = left.publishedAt ?? left.generatedAt
      const rightDate = right.publishedAt ?? right.generatedAt
      return rightDate.getTime() - leftDate.getTime() || left.id.localeCompare(right.id)
    })
  }

  private async resolveHealthProfile(studentId: string, schoolId: string): Promise<StudentHealthProfile | undefined> {
    return (await this.studentHealthProfiles.list({ studentId, schoolId }))
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime() || left.id.localeCompare(right.id))[0]
  }

  private async resolveNotes(
    studentId: string,
    schoolId: string,
    visibility: StudentDetailVisibility,
  ): Promise<StudentNote[]> {
    const notes = await this.studentNotes.list({ studentId, schoolId })
    return notes
      .filter(note => this.canReadNote(note, visibility))
      .sort((left, right) =>
        right.createdAt.getTime() - left.createdAt.getTime()
        || left.id.localeCompare(right.id))
  }

  private canReadNote(note: StudentNote, visibility: StudentDetailVisibility): boolean {
    if (!visibility.includesNotes) {
      return false
    }
    if (visibility.includesHealthProfile) {
      return true
    }
    if (this.actor.kind === 'staff') {
      return note.visibility !== StudentNoteVisibility.AdminOnly
    }
    return note.visibility === StudentNoteVisibility.GuardianVisible
  }

  private async findActiveAcademicYear(schoolId: string): Promise<AcademicYear | undefined> {
    const academicYears = await this.academicYears.list({ schoolId })
    return academicYears.find(academicYear => academicYear.isActive) ?? academicYears[0]
  }

  private async resolveVisibility(): Promise<StudentDetailVisibility> {
    if (this.actor.kind === 'staff') {
      const staffMember = await this.staffMembers.findById(this.actor.staffMemberId)
      const roles = staffMember?.roles ?? []
      const hasFullStudentAccess = roles.some(role => role === StaffRole.Admin || role === StaffRole.Principal)
        || roles.includes(StaffRole.Coordinator)
      if (hasFullStudentAccess) {
        return {
          includesFinance: true,
          includesGuardianPreferences: true,
          includesHealthProfile: true,
          includesNotes: true,
          includesPublishedReportCards: true,
          includesEnrollmentHistory: true,
        }
      }
      if (roles.includes(StaffRole.Accountant)) {
        return {
          includesFinance: true,
          includesGuardianPreferences: true,
          includesHealthProfile: false,
          includesNotes: false,
          includesPublishedReportCards: false,
          includesEnrollmentHistory: false,
        }
      }
      return {
        includesFinance: false,
        includesGuardianPreferences: true,
        includesHealthProfile: false,
        includesNotes: true,
        includesPublishedReportCards: true,
        includesEnrollmentHistory: false,
      }
    }
    return {
      includesFinance: true,
      includesGuardianPreferences: true,
      includesHealthProfile: false,
      includesNotes: true,
      includesPublishedReportCards: true,
      includesEnrollmentHistory: false,
    }
  }
}

export class ReportCardDetailService {
  constructor(args: ServiceArgs) {
    this.students = args.repositories.students
    this.classGroups = args.repositories.classGroups
    this.academicPeriods = args.repositories.academicPeriods
    this.definitions = args.repositories.definitions
    this.reportCardResults = args.repositories.results
    this.assessments = args.repositories.assessments
    this.assessmentResults = args.repositories.assessmentResults
  }

  private readonly students: SchoolRepositories['students']
  private readonly classGroups: SchoolRepositories['classGroups']
  private readonly academicPeriods: SchoolRepositories['academicPeriods']
  private readonly definitions: SchoolRepositories['definitions']
  private readonly reportCardResults: SchoolRepositories['results']
  private readonly assessments: SchoolRepositories['assessments']
  private readonly assessmentResults: SchoolRepositories['assessmentResults']

  async getReportCardDetail({
    schoolId,
    reportCardResultId,
  }: {
    schoolId: string
    reportCardResultId: string
  }): Promise<ReportCardDetail> {
    const reportCard = await this.reportCardResults.findById(reportCardResultId)
    if (!reportCard) {
      denyResourceAccess()
    }
    const [student, classGroup, period, definition] = await Promise.all([
      this.students.findById(reportCard.studentId),
      this.classGroups.findById(reportCard.classGroupId),
      this.academicPeriods.findById(reportCard.periodId),
      this.definitions.findById(reportCard.reportCardDefinitionId),
    ])
    if (
      !student
      || !classGroup
      || !period
      || !definition
      || student.schoolId !== schoolId
      || classGroup.schoolId !== schoolId
      || period.schoolId !== schoolId
      || definition.schoolId !== schoolId
      || classGroup.academicYearId !== period.academicYearId
      || definition.academicYearId !== period.academicYearId
    ) {
      denyResourceAccess()
    }
    const results = await this.assessmentResults.list({ studentId: student.id })
    const assessmentResults: ReportCardDetailAssessmentResult[] = []
    for (const result of results) {
      const assessment = await this.assessments.findById(result.assessmentId)
      if (assessment?.periodId === period.id && assessment.classGroupId === classGroup.id) {
        assessmentResults.push({ assessment, result })
      }
    }
    assessmentResults.sort((left, right) =>
      left.assessment.createdAt.getTime() - right.assessment.createdAt.getTime()
      || left.assessment.id.localeCompare(right.assessment.id))
    return { reportCard, student, classGroup, period, definition, assessmentResults }
  }
}

export class AssessmentEntryReviewService {
  constructor(args: ServiceArgs) {
    this.assessments = args.repositories.assessments
    this.assessmentResults = args.repositories.assessmentResults
    this.classGroups = args.repositories.classGroups
    this.classSubjects = args.repositories.classSubjects
    this.subjects = args.repositories.subjects
    this.academicPeriods = args.repositories.academicPeriods
    this.enrollments = args.repositories.enrollments
    this.students = args.repositories.students
    this.reportCardResults = args.repositories.results
  }

  private readonly assessments: SchoolRepositories['assessments']
  private readonly assessmentResults: SchoolRepositories['assessmentResults']
  private readonly classGroups: SchoolRepositories['classGroups']
  private readonly classSubjects: SchoolRepositories['classSubjects']
  private readonly subjects: SchoolRepositories['subjects']
  private readonly academicPeriods: SchoolRepositories['academicPeriods']
  private readonly enrollments: SchoolRepositories['enrollments']
  private readonly students: SchoolRepositories['students']
  private readonly reportCardResults: SchoolRepositories['results']

  async getAssessmentEntryReview({
    schoolId,
    assessmentId,
  }: {
    schoolId: string
    assessmentId: string
  }): Promise<AssessmentEntryReview> {
    const assessment = await this.assessments.findById(assessmentId)
    if (!assessment) {
      denyResourceAccess()
    }
    const [classGroup, classSubject, period] = await Promise.all([
      this.classGroups.findById(assessment.classGroupId),
      this.classSubjects.findById(assessment.classSubjectId),
      this.academicPeriods.findById(assessment.periodId),
    ])
    const subject = classSubject ? await this.subjects.findById(classSubject.subjectId) : undefined
    if (
      !classGroup
      || !classSubject
      || !subject
      || !period
      || classGroup.schoolId !== schoolId
      || subject.schoolId !== schoolId
      || period.schoolId !== schoolId
      || classSubject.classGroupId !== classGroup.id
      || period.academicYearId !== classGroup.academicYearId
    ) {
      denyResourceAccess()
    }
    const enrollments = await this.enrollments.list({
      classGroupId: classGroup.id,
      status: StudentClassEnrollmentStatus.Active,
    })
    const rows: AssessmentEntryReviewRow[] = []
    for (const enrollment of enrollments) {
      const student = await this.students.findById(enrollment.studentId)
      if (!student || student.schoolId !== schoolId) {
        denyResourceAccess()
      }
      const [results, reportCard] = await Promise.all([
        this.assessmentResults.list({ assessmentId: assessment.id, studentId: student.id }),
        this.reportCardResults.findByStudentAndPeriod(student.id, period.id),
      ])
      rows.push({
        student,
        result: results[0],
        isLockedByPublishedReportCard: reportCard?.status === ReportCardResultStatus.Published,
      })
    }
    rows.sort((left, right) =>
      left.student.lastName.localeCompare(right.student.lastName)
      || left.student.firstName.localeCompare(right.student.firstName)
      || left.student.id.localeCompare(right.student.id))
    return { assessment, classGroup, classSubject, subject, period, rows }
  }
}

export class ClassGroupReadService {
  constructor(args: ServiceArgs) {
    this.academicYears = args.repositories.academicYears
    this.classGroups = args.repositories.classGroups
    this.enrollments = args.repositories.enrollments
    this.classSubjects = args.repositories.classSubjects
    this.staffAssignments = args.repositories.staffAssignments
    this.staffMembers = args.repositories.staffMembers
    this.subjects = args.repositories.subjects
    this.sessions = args.repositories.sessions
  }

  private readonly academicYears: SchoolRepositories['academicYears']
  private readonly classGroups: SchoolRepositories['classGroups']
  private readonly enrollments: SchoolRepositories['enrollments']
  private readonly classSubjects: SchoolRepositories['classSubjects']
  private readonly staffAssignments: SchoolRepositories['staffAssignments']
  private readonly staffMembers: SchoolRepositories['staffMembers']
  private readonly subjects: SchoolRepositories['subjects']
  private readonly sessions: SchoolRepositories['sessions']

  async listClassGroups({
    schoolId,
    academicYearId,
  }: {
    schoolId: string
    academicYearId?: string
  }): Promise<ClassGroupDirectory> {
    const activeAcademicYear = await this.resolveAcademicYear({ schoolId, academicYearId })
    const classGroups = activeAcademicYear
      ? await this.classGroups.list({ academicYearId: activeAcademicYear.id })
      : []
    const rows = await Promise.all(
      classGroups.map(async (classGroup) => {
        const [courseAssignments, enrollments] = await Promise.all([
          this.listClassGroupCourses(classGroup.id),
          this.enrollments.list({ classGroupId: classGroup.id, status: StudentClassEnrollmentStatus.Active }),
        ])
        const teacherNames = [...new Set(courseAssignments.map(row => row.teacherName).filter(name => name !== 'Unassigned'))]

        return {
          classGroup,
          studentCount: enrollments.length,
          courseCount: courseAssignments.length,
          teacherNames,
        }
      }),
    )
    rows.sort((left, right) =>
      left.classGroup.name.localeCompare(right.classGroup.name)
      || left.classGroup.id.localeCompare(right.classGroup.id))

    return {
      activeAcademicYear,
      rows,
    }
  }

  async listClassGroupCourses(classGroupId: string): Promise<ClassGroupCourseAssignment[]> {
    await this.requireClassGroup(classGroupId)
    const classSubjects = await this.classSubjects.list({ classGroupId })
    const rows = await Promise.all(
      classSubjects.map(async (classSubject) => {
        const subject = await this.subjects.findById(classSubject.subjectId)
        if (!subject) {
          return undefined
        }
        const teacher = await this.resolveTeacher(classSubject.id)
        return {
          classSubject,
          subject,
          teacher,
          teacherName: teacher?.fullName ?? 'Unassigned',
        }
      }),
    )
    const courseAssignments: ClassGroupCourseAssignment[] = []
    for (const row of rows) {
      if (row) {
        courseAssignments.push(row)
      }
    }
    return courseAssignments
  }

  async listClassGroupTimetable(classGroupId: string): Promise<ClassGroupTimetableEntry[]> {
    const classGroup = await this.requireClassGroup(classGroupId)
    const [courseAssignments, sessions] = await Promise.all([
      this.listClassGroupCourses(classGroupId),
      this.sessions.list({ classGroupId }),
    ])
    const courseByClassSubjectId = new Map(courseAssignments.map(row => [row.classSubject.id, row]))

    return sessions.map((session) => {
      const courseAssignment = session.classSubjectId
        ? courseByClassSubjectId.get(session.classSubjectId)
        : undefined
      return {
        session,
        courseName: courseAssignment?.subject.name ?? session.title,
        teacherName: courseAssignment?.teacherName ?? 'Unassigned',
        roomName: classGroup.name,
      }
    })
  }

  private async resolveTeacher(classSubjectId: string): Promise<StaffMember | undefined> {
    const assignments = await this.staffAssignments.list({ classSubjectId })
    const teacherAssignment = assignments.find(assignment => assignment.role === StaffRole.Teacher)
    const teacherId = teacherAssignment?.staffId
    return teacherId ? this.staffMembers.findById(teacherId) : undefined
  }

  private async requireClassGroup(classGroupId: string): Promise<ClassGroup> {
    const classGroup = await this.classGroups.findById(classGroupId)
    if (!classGroup) {
      throw new Error(`Unknown classGroup: ${classGroupId}`)
    }
    return classGroup
  }

  private async resolveAcademicYear({
    schoolId,
    academicYearId,
  }: {
    schoolId: string
    academicYearId?: string
  }): Promise<AcademicYear | undefined> {
    if (!academicYearId) {
      const academicYears = await this.academicYears.list({ schoolId })
      return academicYears.find(academicYear => academicYear.isActive) ?? academicYears[0]
    }

    const academicYear = await this.academicYears.findById(academicYearId)
    if (!academicYear || academicYear.schoolId !== schoolId) {
      throw new Error(`Academic year ${academicYearId} does not belong to school ${schoolId}`)
    }
    return academicYear
  }
}

export class AttendanceReviewService {
  constructor(args: ServiceArgs) {
    this.classGroups = args.repositories.classGroups
    this.sessions = args.repositories.sessions
    this.attendance = args.repositories.attendance
    this.enrollments = args.repositories.enrollments
    this.students = args.repositories.students
  }

  private readonly classGroups: SchoolRepositories['classGroups']
  private readonly sessions: SchoolRepositories['sessions']
  private readonly attendance: SchoolRepositories['attendance']
  private readonly enrollments: SchoolRepositories['enrollments']
  private readonly students: SchoolRepositories['students']

  async getAttendanceSessionReview({
    schoolId,
    classGroupId,
    date,
    sessionId,
  }: {
    schoolId: string
    classGroupId: string
    academicYearId?: string
    date: Date
    sessionId?: string
  }): Promise<AttendanceReview> {
    const classGroup = await this.classGroups.findById(classGroupId)
    if (!classGroup || classGroup.schoolId !== schoolId) {
      denyResourceAccess()
    }

    const allSessions = await this.sessions.list({ classGroupId: classGroup.id })
    const datedSessions = allSessions.filter(session => isSameDate(session.startsAt, date))
    const availableSessions = classGroup.attendanceMode === AttendanceMode.Daily
      ? datedSessions
      : datedSessions.length > 0 ? datedSessions : allSessions
    const selectedSession
      = (sessionId ? availableSessions.find(candidate => candidate.id === sessionId) : undefined)
        ?? availableSessions[0]
    const sessionOptions = await Promise.all(
      availableSessions.map(async session => ({
        session,
        label: await this.resolveSessionLabel(session),
      })),
    )

    if (!selectedSession && classGroup.attendanceMode !== AttendanceMode.Daily) {
      return {
        classGroup,
        availableSessions: sessionOptions,
        selectedSession: undefined,
        selectedDate: date,
        rows: [],
        summary: { present: 0, absent: 0, excusedAbsent: 0, late: 0, total: 0 },
      }
    }

    const [records, enrollments] = await Promise.all([
      selectedSession ? this.attendance.list({ sessionId: selectedSession.id }) : [],
      this.enrollments.list({ classGroupId: classGroup.id, status: StudentClassEnrollmentStatus.Active }),
    ])
    const recordByStudentId = new Map(records.map(record => [record.studentId, record]))
    const rows = (
      await Promise.all(
        enrollments.map(async (enrollment) => {
          const student = await this.students.findById(enrollment.studentId)
          if (!student) {
            return undefined
          }
          const record = recordByStudentId.get(student.id)
          return {
            student,
            record,
            status: record?.status ?? AttendanceStatus.Present,
          }
        }),
      )
    )
    const attendanceRows: AttendanceReviewRow[] = []
    for (const row of rows) {
      if (row) {
        attendanceRows.push(row)
      }
    }

    const summary = attendanceRows.reduce<AttendanceReviewSummary>(
      (acc, row) => {
        if (row.status === AttendanceStatus.Present)
          acc.present += 1
        if (row.status === AttendanceStatus.Absent)
          acc.absent += 1
        if (
          row.status === AttendanceStatus.Absent
          && row.record?.justificationStatus === AttendanceJustificationStatus.Excused
        ) {
          acc.excusedAbsent += 1
        }
        if (row.status === AttendanceStatus.Late)
          acc.late += 1
        acc.total += 1
        return acc
      },
      { present: 0, absent: 0, excusedAbsent: 0, late: 0, total: 0 },
    )

    return {
      classGroup,
      availableSessions: sessionOptions,
      selectedSession,
      selectedDate: date,
      rows: attendanceRows,
      summary,
    }
  }

  private async resolveSessionLabel(session: Session): Promise<string> {
    return session.title
  }
}

export class IncidentReadService {
  constructor(args: ServiceArgs) {
    this.incidents = args.repositories.incidents
    this.studentIncidentInvolvements = args.repositories.studentIncidentInvolvements
    this.studentDisciplinaryActions = args.repositories.studentDisciplinaryActions
    this.disciplinaryActions = args.repositories.disciplinaryActions
    this.students = args.repositories.students
    this.staffMembers = args.repositories.staffMembers
    this.classGroups = args.repositories.classGroups
    this.sessions = args.repositories.sessions
  }

  private readonly incidents: SchoolRepositories['incidents']
  private readonly studentIncidentInvolvements: SchoolRepositories['studentIncidentInvolvements']
  private readonly studentDisciplinaryActions: SchoolRepositories['studentDisciplinaryActions']
  private readonly disciplinaryActions: SchoolRepositories['disciplinaryActions']
  private readonly students: SchoolRepositories['students']
  private readonly staffMembers: SchoolRepositories['staffMembers']
  private readonly classGroups: SchoolRepositories['classGroups']
  private readonly sessions: SchoolRepositories['sessions']

  async getIncidentDetail({
    schoolId,
    incidentId,
  }: {
    schoolId: string
    incidentId: string
  }): Promise<IncidentDetail> {
    const incident = await this.incidents.findById(incidentId)
    if (!incident || incident.schoolId !== schoolId) {
      denyResourceAccess()
    }
    const [reporter, classGroup, session] = await Promise.all([
      this.staffMembers.findById(incident.reporterId),
      incident.classGroupId ? this.classGroups.findById(incident.classGroupId) : undefined,
      incident.sessionId ? this.sessions.findById(incident.sessionId) : undefined,
    ])
    if (
      (reporter && reporter.schoolId !== schoolId)
      || (incident.classGroupId && (!classGroup || classGroup.schoolId !== schoolId))
      || (incident.sessionId && (!session || session.classGroupId !== incident.classGroupId))
    ) {
      denyResourceAccess()
    }
    const involvements = await this.resolveInvolvements(incident, schoolId)
    return { incident, reporter, classGroup, session, involvements }
  }

  async listStudentIncidents({
    schoolId,
    studentId,
  }: {
    schoolId: string
    studentId: string
  }): Promise<StudentIncidentDirectory> {
    const student = await this.students.findById(studentId)
    if (!student || student.schoolId !== schoolId) {
      denyResourceAccess()
    }
    const involvements = await this.studentIncidentInvolvements.list({ studentId })
    const rows: StudentIncidentSummary[] = []
    for (const involvement of involvements) {
      const incident = await this.incidents.findById(involvement.incidentId)
      if (!incident || incident.schoolId !== schoolId) {
        denyResourceAccess()
      }
      rows.push({
        incident,
        involvement,
        actions: await this.resolveStudentActions({
          schoolId,
          incidentId: incident.id,
          studentId,
        }),
      })
    }
    rows.sort((left, right) =>
      right.incident.date.getTime() - left.incident.date.getTime()
      || left.incident.id.localeCompare(right.incident.id))
    return { student, rows }
  }

  private async resolveInvolvements(incident: Incident, schoolId: string): Promise<IncidentInvolvementDetail[]> {
    const involvements = await this.studentIncidentInvolvements.list({ incidentId: incident.id })
    const rows: IncidentInvolvementDetail[] = []
    for (const involvement of involvements) {
      const student = await this.students.findById(involvement.studentId)
      if (!student || student.schoolId !== schoolId) {
        denyResourceAccess()
      }
      rows.push({
        involvement,
        student,
        actions: await this.resolveStudentActions({
          schoolId,
          incidentId: incident.id,
          studentId: student.id,
        }),
      })
    }
    rows.sort((left, right) =>
      left.student.lastName.localeCompare(right.student.lastName)
      || left.student.firstName.localeCompare(right.student.firstName)
      || left.student.id.localeCompare(right.student.id))
    return rows
  }

  private async resolveStudentActions({
    schoolId,
    incidentId,
    studentId,
  }: {
    schoolId: string
    incidentId: string
    studentId: string
  }): Promise<IncidentDisciplinaryActionDetail[]> {
    const appliedActions = await this.studentDisciplinaryActions.list({ incidentId, studentId })
    const rows: IncidentDisciplinaryActionDetail[] = []
    for (const studentDisciplinaryAction of appliedActions) {
      const disciplinaryAction = await this.disciplinaryActions.findById(studentDisciplinaryAction.disciplinaryActionId)
      if (
        !disciplinaryAction
        || disciplinaryAction.schoolId !== schoolId
        || studentDisciplinaryAction.schoolId !== schoolId
      ) {
        denyResourceAccess()
      }
      rows.push({ studentDisciplinaryAction, disciplinaryAction })
    }
    rows.sort((left, right) =>
      left.studentDisciplinaryAction.createdAt.getTime() - right.studentDisciplinaryAction.createdAt.getTime()
      || left.studentDisciplinaryAction.id.localeCompare(right.studentDisciplinaryAction.id))
    return rows
  }
}

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
  private readonly actor: AuthorizedServiceArgs['actor']
  private readonly authorizationPolicy: AuthorizedServiceArgs['authorizationPolicy']
  private readonly classGroupRepository: SchoolRepositories['classGroups']
  private readonly sessionRepository: SchoolRepositories['sessions']
  private readonly academicYearRepository: SchoolRepositories['academicYears']
  private readonly reportCardResultRepository: SchoolRepositories['results']
  private readonly assessmentRepository: SchoolRepositories['assessments']
  private readonly classSubjectRepository: SchoolRepositories['classSubjects']
  private readonly announcementRepository: SchoolRepositories['announcements']
  private readonly incidentRepository: SchoolRepositories['incidents']
  private readonly attendanceRepository: SchoolRepositories['attendance']
  private readonly guardianRepositoryForAttachments: SchoolRepositories['guardians']
  private readonly paymentRepository: SchoolRepositories['payments']
  private readonly studentFeeRepository: SchoolRepositories['studentFees']
  private readonly studentHealthProfileRepository: SchoolRepositories['studentHealthProfiles']
  private readonly studentDisciplinaryActionRepository: SchoolRepositories['studentDisciplinaryActions']
  private readonly assessmentResultRepository: SchoolRepositories['assessmentResults']

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
    this.guardianRepositoryForAttachments = args.repositories.guardians
    this.paymentRepository = args.repositories.payments
    this.studentFeeRepository = args.repositories.studentFees
    this.studentHealthProfileRepository = args.repositories.studentHealthProfiles
    this.studentDisciplinaryActionRepository = args.repositories.studentDisciplinaryActions
    this.assessmentResultRepository = args.repositories.assessmentResults
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

  async getStudentDetail(input: Parameters<StudentDetailService['getStudentDetail']>[0]) {
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

  async getFinanceLedger(input: Parameters<FinanceLedgerService['getFinanceLedger']>[0]) {
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

  async getStudentEnrollmentHistory(input: Parameters<StudentEnrollmentHistoryService['getStudentEnrollmentHistory']>[0]) {
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

  async getReportCardDetail(input: Parameters<ReportCardDetailService['getReportCardDetail']>[0]) {
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

  async getAssessmentEntryReview(input: Parameters<AssessmentEntryReviewService['getAssessmentEntryReview']>[0]) {
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

  async listAnnouncements(input: Parameters<CommunicationsReadService['listAnnouncements']>[0]) {
    await this.authorizeSchool('queries.read_communications', input.schoolId)
    return this.communicationsRead.listAnnouncements(input)
  }

  async getAnnouncementDetail(input: Parameters<CommunicationsReadService['getAnnouncementDetail']>[0]) {
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

  async getCalendarEvents(input: Parameters<CalendarReadService['getCalendarEvents']>[0]) {
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

  async listResources(input: Parameters<ResourceReadService['listResources']>[0]) {
    await this.authorizationPolicy.requirePermission(this.actor, {
      action: 'resources.read',
      resource: { schoolId: input.schoolId },
    })
    return this.resourceRead.listResources(input)
  }

  async listAttachments(input: Parameters<AttachmentReadService['listAttachments']>[0]) {
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

  async getClassSubjectProgressDetail(input: Parameters<CurriculumProgressReadService['getClassSubjectProgressDetail']>[0]) {
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

  async getIncidentDetail(input: Parameters<IncidentReadService['getIncidentDetail']>[0]) {
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

  async listStudentIncidents(input: Parameters<IncidentReadService['listStudentIncidents']>[0]) {
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
        const guardian = await this.guardianRepositoryForAttachments.findById(ownerId)
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
