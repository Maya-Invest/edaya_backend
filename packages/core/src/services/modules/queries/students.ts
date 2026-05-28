import type { ReportCardResult } from '../../../entities/assessments/report-card-result'
import type { StudentFeeSummary } from '../../../entities/finances/student-fee'
import type { AcademicYear } from '../../../entities/school/academic-year'
import type { ClassGroup } from '../../../entities/school/class-group'
import type { GradeLevel } from '../../../entities/school/grade-level'
import type { School } from '../../../entities/school/school'
import type { Guardian } from '../../../entities/students/guardian'
import type { GuardianStudentLink } from '../../../entities/students/guardian-student-link'
import type { Student } from '../../../entities/students/student'
import type { StudentClassEnrollment } from '../../../entities/students/student-class-enrollment'
import type { StudentHealthProfile } from '../../../entities/students/student-health-profile'
import type { StudentNote } from '../../../entities/students/student-note'
import type { SchoolRepositories } from '../../../ports/school-repositories'
import type { AttendanceSummary } from '../../../value_object/attendance-summary'
import type { AuthorizedServiceArgs } from '../../authorization'
import type { ServiceArgs } from '../../school-headless-app'
import type { PaginationParams } from '../../shared/pagination'
import { ReportCardResultStatus } from '../../../entities/assessments/report-card-result'
import { buildStudentFeeSummary, FeeStatus } from '../../../entities/finances/student-fee'
import { AttendanceJustificationStatus, AttendanceStatus } from '../../../entities/scheduling/attendance-record'
import { StaffRole } from '../../../entities/school/staff-member'
import { StudentClassEnrollmentStatus } from '../../../entities/students/student-class-enrollment'
import { StudentNoteVisibility } from '../../../entities/students/student-note'
import { AttendanceSummary as AttendanceSummaryValue } from '../../../value_object/attendance-summary'
import { denyResourceAccess } from '../../authorization'
import { paginateSlice } from '../../shared/pagination'
import { requireSchool } from '../../shared/require-school'

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

// ---------------------------------------------------------------------------
// StudentDirectoryService
// ---------------------------------------------------------------------------

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
    pagination,
  }: {
    schoolId: string
    academicYearId?: string
    pagination?: PaginationParams
  }): Promise<StudentDirectory> {
    const school = await requireSchool(this.schools, schoolId)
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

    const paginatedStudents = paginateSlice(students, pagination)

    const rows = await Promise.all(
      paginatedStudents.map(async (student) => {
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

// ---------------------------------------------------------------------------
// StudentEnrollmentHistoryService
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// StudentDetailService
// ---------------------------------------------------------------------------

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
    if (this.actor.kind === 'guardian') {
      return {
        includesFinance: true,
        includesGuardianPreferences: true,
        includesHealthProfile: false,
        includesNotes: true,
        includesPublishedReportCards: true,
        includesEnrollmentHistory: true,
      }
    }
    if (this.actor.kind === 'student') {
      return {
        includesFinance: false,
        includesGuardianPreferences: false,
        includesHealthProfile: false,
        includesNotes: false,
        includesPublishedReportCards: true,
        includesEnrollmentHistory: false,
      }
    }
    return {
      includesFinance: false,
      includesGuardianPreferences: false,
      includesHealthProfile: false,
      includesNotes: false,
      includesPublishedReportCards: true,
      includesEnrollmentHistory: false,
    }
  }
}
