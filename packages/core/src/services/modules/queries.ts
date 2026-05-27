import type { ClassSubject } from '../../entities/academics/class-subject'
import type { Subject } from '../../entities/academics/subject'
import type { Assessment } from '../../entities/assessments/assessment'
import type { AssessmentResult } from '../../entities/assessments/assessment-result'
import type { ReportCardDefinition } from '../../entities/assessments/report-card-definition'
import type { ReportCardResult } from '../../entities/assessments/report-card-result'
import type { Fee } from '../../entities/finances/fee'
import type { Payment } from '../../entities/finances/payment'
import type { StudentFee, StudentFeeSummary } from '../../entities/finances/student-fee'
import type { Announcement } from '../../entities/messaging/announcement'
import type { AttendanceRecord } from '../../entities/scheduling/attendance-record'
import type { Session } from '../../entities/scheduling/session'
import type { AcademicPeriod } from '../../entities/school/academic-period'
import type { AcademicYear } from '../../entities/school/academic-year'
import type { ClassGroup } from '../../entities/school/class-group'
import type { GradeLevel } from '../../entities/school/grade-level'
import type { GradeScale } from '../../entities/school/grade-scale'
import type { School } from '../../entities/school/school'
import type { StaffMember } from '../../entities/school/staff-member'
import type { Student } from '../../entities/students/student'
import type { StudentClassEnrollment } from '../../entities/students/student-class-enrollment'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { AuthorizationAction, AuthorizedServiceArgs } from '../authorization'
import type { ServiceArgs } from '../school-headless-app'
import { ReportCardResultStatus } from '../../entities/assessments/report-card-result'
import { buildStudentFeeSummary, FeeStatus } from '../../entities/finances/student-fee'
import { AttendanceStatus } from '../../entities/scheduling/attendance-record'
import { StaffRole } from '../../entities/school/staff-member'
import { StudentClassEnrollmentStatus } from '../../entities/students/student-class-enrollment'
import { isSameDate } from '../../entities/utils'
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
          balanceDue: fees.reduce((sum, fee) => sum + fee.balanceDue.amount, 0),
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
    const availableSessions = datedSessions.length > 0 ? datedSessions : allSessions
    const selectedSession
      = (sessionId ? availableSessions.find(candidate => candidate.id === sessionId) : undefined)
        ?? availableSessions[0]
    const sessionOptions = await Promise.all(
      availableSessions.map(async session => ({
        session,
        label: await this.resolveSessionLabel(session),
      })),
    )

    if (!selectedSession) {
      return {
        classGroup,
        availableSessions: sessionOptions,
        selectedSession: undefined,
        selectedDate: date,
        rows: [],
        summary: { present: 0, absent: 0, late: 0, total: 0 },
      }
    }

    const [records, enrollments] = await Promise.all([
      this.attendance.list({ sessionId: selectedSession.id }),
      this.enrollments.list({ classGroupId: selectedSession.classGroupId, status: StudentClassEnrollmentStatus.Active }),
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
        if (row.status === AttendanceStatus.Late)
          acc.late += 1
        acc.total += 1
        return acc
      },
      { present: 0, absent: 0, late: 0, total: 0 },
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

export class SchoolQueryService {
  private readonly workspace: WorkspaceService
  private readonly schoolOverview: SchoolOverviewService
  private readonly studentDirectory: StudentDirectoryService
  private readonly studentEnrollmentHistory: StudentEnrollmentHistoryService
  private readonly reportCardDetail: ReportCardDetailService
  private readonly assessmentEntryReview: AssessmentEntryReviewService
  private readonly financeLedger: FinanceLedgerService
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
  private readonly reportCardResultRepository: SchoolRepositories['results']
  private readonly assessmentRepository: SchoolRepositories['assessments']
  private readonly classSubjectRepository: SchoolRepositories['classSubjects']

  constructor(args: ServiceArgs) {
    this.actor = args.actor
    this.authorizationPolicy = args.authorizationPolicy
    this.workspace = new WorkspaceService(args)
    this.schoolOverview = new SchoolOverviewService(args)
    this.studentDirectory = new StudentDirectoryService(args)
    this.studentEnrollmentHistory = new StudentEnrollmentHistoryService(args)
    this.reportCardDetail = new ReportCardDetailService(args)
    this.assessmentEntryReview = new AssessmentEntryReviewService(args)
    this.financeLedger = new FinanceLedgerService(args)
    this.classGroupRead = new ClassGroupReadService(args)
    this.attendanceReview = new AttendanceReviewService(args)
    this.guardianRepository = args.repositories.guardians
    this.guardianStudentLinks = args.repositories.guardianLinks
    this.studentRepository = args.repositories.students
    this.classGroupRepository = args.repositories.classGroups
    this.sessionRepository = args.repositories.sessions
    this.academicYearRepository = args.repositories.academicYears
    this.reportCardResultRepository = args.repositories.results
    this.assessmentRepository = args.repositories.assessments
    this.classSubjectRepository = args.repositories.classSubjects
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
}
