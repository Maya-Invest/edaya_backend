import type { StudentEnrollment } from '$lib/core/entities/administration/student-enrollment'
import type { AcademicPeriod } from '$lib/core/entities/core/academic-period'
import type { ClassGroup } from '$lib/core/entities/core/class-group'
import type { Student } from '$lib/core/entities/core/student'
import type { AcademicPeriodRepository } from '$lib/core/ports/academic-period-repository'
import type { AssessmentRepository } from '$lib/core/ports/assessment-repository'
import type { ClassGroupRepository } from '$lib/core/ports/class-group-repository'
import type { GradeRepository } from '$lib/core/ports/grade-repository'
import type { ReportCardDefinitionRepository } from '$lib/core/ports/report-card-definition-repository'
import type { ReportCardResultRepository } from '$lib/core/ports/report-card-result-repository'
import type { StudentEnrollmentRepository } from '$lib/core/ports/student-enrollment-repository'
import type { StudentRepository } from '$lib/core/ports/student-repository'
import type { GradeService } from '$lib/core/services/assessment/grade'
import type { AttendanceService } from '$lib/core/services/planing/attendance'
import { ReportCardResult, ReportCardResultStatus } from '$lib/core/entities/assessments/report-card-result'

export interface ReportCardResultServiceArgs {
  studentRepository: StudentRepository
  classGroupRepository: ClassGroupRepository
  studentEnrollmentRepository: StudentEnrollmentRepository
  academicPeriodRepository: AcademicPeriodRepository
  assessmentRepository: AssessmentRepository
  gradeRepository: GradeRepository
  reportCardDefinitionRepository: ReportCardDefinitionRepository
  reportCardResultRepository: ReportCardResultRepository
  attendanceService: AttendanceService
  gradeService: GradeService
}

export class ReportCardResultService {
  constructor(args: ReportCardResultServiceArgs) {
    this.students = args.studentRepository
    this.classGroups = args.classGroupRepository
    this.enrollments = args.studentEnrollmentRepository
    this.academicPeriods = args.academicPeriodRepository
    this.assessments = args.assessmentRepository
    this.grades = args.gradeRepository
    this.reportCardDefinitions = args.reportCardDefinitionRepository
    this.reportCardResults = args.reportCardResultRepository
    this.attendance = args.attendanceService
    this.gradeService = args.gradeService
  }

  private readonly students: StudentRepository
  private readonly classGroups: ClassGroupRepository
  private readonly enrollments: StudentEnrollmentRepository
  private readonly academicPeriods: AcademicPeriodRepository
  private readonly assessments: AssessmentRepository
  private readonly grades: GradeRepository
  private readonly reportCardDefinitions: ReportCardDefinitionRepository
  private readonly reportCardResults: ReportCardResultRepository
  private readonly attendance: AttendanceService
  private readonly gradeService: GradeService

  async generateReportCardResult({
    id,
    studentId,
    periodId,
    reportCardDefinitionId,
    examId,
    generatedAt,
  }: {
    id: string
    studentId: string
    periodId: string
    reportCardDefinitionId?: string
    examId?: string
    generatedAt?: Date
  }): Promise<ReportCardResult> {
    await this.requireStudent(studentId)
    const period = await this.requirePeriod(periodId)
    const enrollment = await this.requireEnrollmentForPeriod({
      studentId,
      academicYearId: period.academicYearId,
    })
    const classGroup = await this.requireClassGroup(enrollment.classGroupId)
    const definition = reportCardDefinitionId
      ? await this.requireReportCardDefinition(reportCardDefinitionId)
      : await this.requireDefaultReportCardDefinition({
          gradeLevelId: classGroup.gradeLevelId,
          academicYearId: period.academicYearId,
        })

    const { sectionResults, overallAverage } = await this.gradeService.buildReportCardResults({
      studentId,
      periodId,
      classGroupId: classGroup.id,
      reportCardDefinitionId: definition.id,
      examId,
    })
    const periodGrades = await this.grades.listByStudentAndPeriod(studentId, periodId)
    const grades = examId ? await this.filterGradesByExam(periodGrades, examId) : periodGrades
    const attendanceSummary = await this.attendance.buildAttendanceSummary({
      studentId,
      startDate: period.startDate,
      endDate: period.endDate,
    })

    const existing = examId
      ? await this.reportCardResults.findByStudentAndExam(studentId, examId)
      : await this.reportCardResults.findByStudentAndPeriod(studentId, periodId)
    const reportCard = new ReportCardResult({
      id: existing?.id ?? id,
      reportCardDefinitionId: definition.id,
      studentId,
      classGroupId: classGroup.id,
      periodId,
      examId,
      sectionResults,
      attendanceSummary,
      gradeCount: grades.length,
      overallAverage,
      status: existing?.status ?? ReportCardResultStatus.Draft,
      generatedAt: existing?.generatedAt ?? generatedAt,
      publishedAt: existing?.publishedAt,
    })
    await this.reportCardResults.save(reportCard)
    return reportCard
  }

  async publishReportCardResult({
    id,
    studentId,
    periodId,
    reportCardDefinitionId,
    examId,
    publishedAt,
  }: {
    id: string
    studentId: string
    periodId: string
    reportCardDefinitionId?: string
    examId?: string
    publishedAt?: Date
  }): Promise<ReportCardResult> {
    const generated = await this.generateReportCardResult({ id, studentId, periodId, reportCardDefinitionId, examId })
    const published = generated.copyWith({
      status: ReportCardResultStatus.Published,
      publishedAt: publishedAt ?? new Date(),
    })
    await this.reportCardResults.save(published)
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
      const classGroup = await this.classGroups.findById(enrollment.classGroupId)
      if (classGroup?.academicYearId === academicYearId) {
        return enrollment
      }
    }
    throw new Error(`Student ${studentId} is not enrolled in academic year ${academicYearId}`)
  }

  private async requireClassGroup(classGroupId: string): Promise<ClassGroup> {
    const classGroup = await this.classGroups.findById(classGroupId)
    if (!classGroup) {
      throw new Error(`Unknown classGroup: ${classGroupId}`)
    }
    return classGroup
  }

  private async requireReportCardDefinition(reportCardDefinitionId: string) {
    const definition = await this.reportCardDefinitions.findById(reportCardDefinitionId)
    if (!definition) {
      throw new Error(`Unknown report card definition: ${reportCardDefinitionId}`)
    }
    return definition
  }

  private async requireDefaultReportCardDefinition({
    gradeLevelId,
    academicYearId,
  }: {
    gradeLevelId: string
    academicYearId: string
  }) {
    const definition = await this.reportCardDefinitions.findDefaultByGradeLevel(gradeLevelId, academicYearId)
    if (!definition) {
      throw new Error(`No default report card definition for grade level ${gradeLevelId}`)
    }
    return definition
  }

  private async filterGradesByExam(grades: readonly { assessmentId: string }[], examId: string) {
    const filtered = []
    for (const grade of grades) {
      const assessment = await this.assessments.findById(grade.assessmentId)
      if (assessment?.examId === examId) {
        filtered.push(grade)
      }
    }
    return filtered
  }
}
