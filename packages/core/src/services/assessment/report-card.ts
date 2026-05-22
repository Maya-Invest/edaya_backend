import type { AcademicPeriod } from '$lib/core/entities/academic-period'
import type { Classroom } from '$lib/core/entities/classroom'
import type { Student } from '$lib/core/entities/student'
import type { StudentEnrollment } from '$lib/core/entities/student-enrollment'
import type { AcademicPeriodRepository } from '$lib/core/ports/academic-period-repository'
import type { ClassroomRepository } from '$lib/core/ports/classroom-repository'
import type { GradeRepository } from '$lib/core/ports/grade-repository'
import type { ReportCardRepository } from '$lib/core/ports/report-card-repository'
import type { StudentEnrollmentRepository } from '$lib/core/ports/student-enrollment-repository'
import type { StudentRepository } from '$lib/core/ports/student-repository'
import type { GradeService } from '$lib/core/services/assessment/grade'
import type { AttendanceService } from '$lib/core/services/planing/attendance'
import { ReportCard, ReportCardStatus } from '$lib/core/entities/report-card'

export interface ReportCardServiceArgs {
  studentRepository: StudentRepository
  classroomRepository: ClassroomRepository
  studentEnrollmentRepository: StudentEnrollmentRepository
  academicPeriodRepository: AcademicPeriodRepository
  gradeRepository: GradeRepository
  reportCardRepository: ReportCardRepository
  attendanceService: AttendanceService
  gradeService: GradeService
}

export class ReportCardService {
  constructor(args: ReportCardServiceArgs) {
    this.students = args.studentRepository
    this.classrooms = args.classroomRepository
    this.enrollments = args.studentEnrollmentRepository
    this.academicPeriods = args.academicPeriodRepository
    this.grades = args.gradeRepository
    this.reportCards = args.reportCardRepository
    this.attendance = args.attendanceService
    this.gradeService = args.gradeService
  }

  private readonly students: StudentRepository
  private readonly classrooms: ClassroomRepository
  private readonly enrollments: StudentEnrollmentRepository
  private readonly academicPeriods: AcademicPeriodRepository
  private readonly grades: GradeRepository
  private readonly reportCards: ReportCardRepository
  private readonly attendance: AttendanceService
  private readonly gradeService: GradeService

  async generateReportCard({
    id,
    studentId,
    periodId,
    generatedAt,
  }: {
    id: string
    studentId: string
    periodId: string
    generatedAt?: Date
  }): Promise<ReportCard> {
    await this.requireStudent(studentId)
    const period = await this.requirePeriod(periodId)
    const enrollment = await this.requireEnrollmentForPeriod({
      studentId,
      academicYearId: period.academicYearId,
    })
    const classroom = await this.requireClassroom(enrollment.classroomId)

    const { moduleResults, overallAverage } = await this.gradeService.buildReportCardResults({
      studentId,
      periodId,
      classroomId: classroom.id,
    })
    const grades = await this.grades.listByStudentAndPeriod(studentId, periodId)
    const attendanceSummary = await this.attendance.buildAttendanceSummary({
      studentId,
      startDate: period.startDate,
      endDate: period.endDate,
    })

    const existing = await this.reportCards.findByStudentAndPeriod(studentId, periodId)
    const reportCard = new ReportCard({
      id: existing?.id ?? id,
      studentId,
      classroomId: classroom.id,
      periodId,
      moduleResults,
      attendanceSummary,
      gradeCount: grades.length,
      overallAverage,
      status: existing?.status ?? ReportCardStatus.Draft,
      generatedAt: existing?.generatedAt ?? generatedAt,
      publishedAt: existing?.publishedAt,
    })
    await this.reportCards.save(reportCard)
    return reportCard
  }

  async publishReportCard({
    id,
    studentId,
    periodId,
    publishedAt,
  }: {
    id: string
    studentId: string
    periodId: string
    publishedAt?: Date
  }): Promise<ReportCard> {
    const generated = await this.generateReportCard({ id, studentId, periodId })
    const published = generated.copyWith({
      status: ReportCardStatus.Published,
      publishedAt: publishedAt ?? new Date(),
    })
    await this.reportCards.save(published)
    return published
  }

  private async requireStudent(studentId: string): Promise<Student> {
    const student = await this.students.findById(studentId)
    if (!student) {
      throw new Error(`Unknown student: ${studentId}`)
    }
    return student
  }

  private async requirePeriod(periodId: string): Promise<AcademicPeriod> {
    const period = await this.academicPeriods.findById(periodId)
    if (!period) {
      throw new Error(`Unknown period: ${periodId}`)
    }
    return period
  }

  private async requireEnrollmentForPeriod({
    studentId,
    academicYearId,
  }: {
    studentId: string
    academicYearId: string
  }): Promise<StudentEnrollment> {
    const enrollments = await this.enrollments.listByStudent(studentId)
    for (const enrollment of enrollments) {
      const classroom = await this.classrooms.findById(enrollment.classroomId)
      if (classroom?.academicYearId === academicYearId) {
        return enrollment
      }
    }
    throw new Error(`Student ${studentId} is not enrolled in academic year ${academicYearId}`)
  }

  private async requireClassroom(classroomId: string): Promise<Classroom> {
    const classroom = await this.classrooms.findById(classroomId)
    if (!classroom) {
      throw new Error(`Unknown classroom: ${classroomId}`)
    }
    return classroom
  }
}
