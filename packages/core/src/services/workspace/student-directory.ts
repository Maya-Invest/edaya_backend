import type { StudentEnrollment } from '$lib/core/entities/administration/student-enrollment'
import type { ReportCardResult } from '$lib/core/entities/assessments/report-card-result'
import type { AcademicYear } from '$lib/core/entities/core/academic-year'
import type { ClassGroup } from '$lib/core/entities/core/class-group'
import type { School } from '$lib/core/entities/core/school'
import type { Student } from '$lib/core/entities/core/student'
import type { AcademicYearRepository } from '$lib/core/ports/academic-year-repository'
import type { ClassGroupRepository } from '$lib/core/ports/class-group-repository'
import type { GuardianStudentLinkRepository } from '$lib/core/ports/guardian-student-link-repository'
import type { ReportCardResultRepository } from '$lib/core/ports/report-card-result-repository'
import type { SchoolRepository } from '$lib/core/ports/school-repository'
import type { StudentEnrollmentRepository } from '$lib/core/ports/student-enrollment-repository'
import type { StudentFeeRepository } from '$lib/core/ports/student-fee-repository'
import type { StudentRepository } from '$lib/core/ports/student-repository'

export interface StudentDirectoryServiceArgs {
  schoolRepository: SchoolRepository
  academicYearRepository: AcademicYearRepository
  classGroupRepository: ClassGroupRepository
  studentRepository: StudentRepository
  studentEnrollmentRepository: StudentEnrollmentRepository
  guardianStudentLinkRepository: GuardianStudentLinkRepository
  reportCardResultRepository: ReportCardResultRepository
  studentFeeRepository: StudentFeeRepository
}

export interface StudentDirectoryRow {
  student: Student
  currentEnrollment?: StudentEnrollment
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

export class StudentDirectoryService {
  constructor(args: StudentDirectoryServiceArgs) {
    this.schools = args.schoolRepository
    this.academicYears = args.academicYearRepository
    this.classGroups = args.classGroupRepository
    this.students = args.studentRepository
    this.enrollments = args.studentEnrollmentRepository
    this.guardianStudentLinks = args.guardianStudentLinkRepository
    this.reportCardResults = args.reportCardResultRepository
    this.fees = args.studentFeeRepository
  }

  private readonly schools: SchoolRepository
  private readonly academicYears: AcademicYearRepository
  private readonly classGroups: ClassGroupRepository
  private readonly students: StudentRepository
  private readonly enrollments: StudentEnrollmentRepository
  private readonly guardianStudentLinks: GuardianStudentLinkRepository
  private readonly reportCardResults: ReportCardResultRepository
  private readonly fees: StudentFeeRepository

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
      ? await this.classGroups.listByAcademicYear(activeAcademicYear.id)
      : []
    const classGroupById = new Map(classGroups.map(classGroup => [classGroup.id, classGroup]))
    const students = await this.students.listBySchool(schoolId)

    const rows = await Promise.all(
      students.map(async (student) => {
        const [currentEnrollment, guardianLinks, reportCardResults, fees] = await Promise.all([
          this.enrollments.findCurrentByStudent(student.id).then(enrollment =>
            enrollment && classGroupById.has(enrollment.classGroupId) ? enrollment : undefined,
          ),
          this.guardianStudentLinks.listByStudent(student.id),
          this.reportCardResults.listByStudent(student.id),
          this.fees.listByStudent(student.id),
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
      const academicYears = await this.academicYears.listBySchool(schoolId)
      return academicYears.find(academicYear => academicYear.isActive) ?? academicYears[0]
    }

    const academicYear = await this.academicYears.findById(academicYearId)
    if (!academicYear || academicYear.schoolId !== schoolId) {
      throw new Error(`Academic year ${academicYearId} does not belong to school ${schoolId}`)
    }
    return academicYear
  }
}
