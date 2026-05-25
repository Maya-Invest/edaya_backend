import type { ReportCardResult } from '../../entities/assessments/report-card-result'
import type { AcademicYear } from '../../entities/school/academic-year'
import type { ClassGroup } from '../../entities/school/class-group'
import type { School } from '../../entities/school/school'
import type { Student } from '../../entities/students/student'
import type { StudentClassEnrollment } from '../../entities/students/student-class-enrollment'
import type {
  SetupRepositories,
  AcademicsRepositories,
  StudentRepositories,
  FinanceRepositories,
  AssessmentRepositories,
} from '../../ports/school-repositories'

export interface StudentDirectoryServiceArgs {
  schoolRepository: SetupRepositories['schools']
  academicYearRepository: SetupRepositories['academicYears']
  classGroupRepository: AcademicsRepositories['classGroups']
  studentRepository: StudentRepositories['students']
  StudentClassEnrollmentRepository: StudentRepositories['enrollments']
  guardianStudentLinkRepository: StudentRepositories['guardianLinks']
  reportCardResultRepository: AssessmentRepositories['results']
  studentFeeRepository: FinanceRepositories['studentFees']
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

export class StudentDirectoryService {
  constructor(args: StudentDirectoryServiceArgs) {
    this.schools = args.schoolRepository
    this.academicYears = args.academicYearRepository
    this.classGroups = args.classGroupRepository
    this.students = args.studentRepository
    this.enrollments = args.StudentClassEnrollmentRepository
    this.guardianStudentLinks = args.guardianStudentLinkRepository
    this.reportCardResults = args.reportCardResultRepository
    this.fees = args.studentFeeRepository
  }

  private readonly schools: SetupRepositories['schools']
  private readonly academicYears: SetupRepositories['academicYears']
  private readonly classGroups: AcademicsRepositories['classGroups']
  private readonly students: StudentRepositories['students']
  private readonly enrollments: StudentRepositories['enrollments']
  private readonly guardianStudentLinks: StudentRepositories['guardianLinks']
  private readonly reportCardResults: AssessmentRepositories['results']
  private readonly fees: FinanceRepositories['studentFees']

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
