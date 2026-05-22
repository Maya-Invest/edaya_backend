import type { AcademicYear } from '$lib/core/entities/core/academic-year'
import type { Classroom } from '$lib/core/entities/core/classroom'
import type { ReportCard } from '$lib/core/entities/assessments/report-card'
import type { School } from '$lib/core/entities/core/school'
import type { Student } from '$lib/core/entities/core/student'
import type { StudentEnrollment } from '$lib/core/entities/administration/student-enrollment'
import type { AcademicYearRepository } from '$lib/core/ports/academic-year-repository'
import type { ClassroomRepository } from '$lib/core/ports/classroom-repository'
import type { GuardianStudentLinkRepository } from '$lib/core/ports/guardian-student-link-repository'
import type { ReportCardRepository } from '$lib/core/ports/report-card-repository'
import type { SchoolFeeRepository } from '$lib/core/ports/school-fee-repository'
import type { SchoolRepository } from '$lib/core/ports/school-repository'
import type { StudentEnrollmentRepository } from '$lib/core/ports/student-enrollment-repository'
import type { StudentRepository } from '$lib/core/ports/student-repository'

export interface StudentDirectoryServiceArgs {
  schoolRepository: SchoolRepository
  academicYearRepository: AcademicYearRepository
  classroomRepository: ClassroomRepository
  studentRepository: StudentRepository
  studentEnrollmentRepository: StudentEnrollmentRepository
  guardianStudentLinkRepository: GuardianStudentLinkRepository
  reportCardRepository: ReportCardRepository
  schoolFeeRepository: SchoolFeeRepository
}

export interface StudentDirectoryRow {
  student: Student
  currentEnrollment?: StudentEnrollment
  classroom?: Classroom
  guardianCount: number
  balanceDue: number
  latestReportCard?: ReportCard
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
    this.classrooms = args.classroomRepository
    this.students = args.studentRepository
    this.enrollments = args.studentEnrollmentRepository
    this.guardianStudentLinks = args.guardianStudentLinkRepository
    this.reportCards = args.reportCardRepository
    this.fees = args.schoolFeeRepository
  }

  private readonly schools: SchoolRepository
  private readonly academicYears: AcademicYearRepository
  private readonly classrooms: ClassroomRepository
  private readonly students: StudentRepository
  private readonly enrollments: StudentEnrollmentRepository
  private readonly guardianStudentLinks: GuardianStudentLinkRepository
  private readonly reportCards: ReportCardRepository
  private readonly fees: SchoolFeeRepository

  async listStudents({
    schoolId,
    academicYearId,
  }: {
    schoolId: string
    academicYearId?: string
  }): Promise<StudentDirectory> {
    const school = await this.requireSchool(schoolId)
    const activeAcademicYear = await this.resolveAcademicYear({ schoolId, academicYearId })
    const classrooms = activeAcademicYear
      ? await this.classrooms.listByAcademicYear(activeAcademicYear.id)
      : []
    const classroomById = new Map(classrooms.map(classroom => [classroom.id, classroom]))
    const students = await this.students.listBySchool(schoolId)

    const rows = await Promise.all(
      students.map(async (student) => {
        const [currentEnrollment, guardianLinks, reportCards, fees] = await Promise.all([
          this.enrollments.findCurrentByStudent(student.id).then(enrollment =>
            enrollment && classroomById.has(enrollment.classroomId) ? enrollment : undefined,
          ),
          this.guardianStudentLinks.listByStudent(student.id),
          this.reportCards.listByStudent(student.id),
          this.fees.listByStudent(student.id),
        ])

        return {
          student,
          currentEnrollment,
          classroom: currentEnrollment ? classroomById.get(currentEnrollment.classroomId) : undefined,
          guardianCount: guardianLinks.length,
          balanceDue: fees.reduce((sum, fee) => sum + fee.balanceDue, 0),
          latestReportCard: this.pickLatestReportCard(reportCards),
        }
      }),
    )

    return {
      school,
      activeAcademicYear,
      rows,
    }
  }

  private pickLatestReportCard(reportCards: readonly ReportCard[]): ReportCard | undefined {
    return reportCards
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
