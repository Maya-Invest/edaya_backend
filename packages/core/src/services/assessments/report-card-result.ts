import type { AcademicPeriod } from '../../entities/school/academic-period'
import type { ClassGroup } from '../../entities/school/class-group'
import type { Student } from '../../entities/students/student'
import type { StudentClassEnrollment } from '../../entities/students/student-class-enrollment'
import type {
  SetupRepositories,
  AcademicsRepositories,
  StudentRepositories,
  AssessmentRepositories,
} from '../../ports/school-repositories'
import type { AtomicExecutionPort } from '../../ports/atomic-execution'
import type { AttendanceService } from '../scheduling/attendance'
import type { GradeService } from './grade'
import { ReportCardResult, ReportCardResultStatus } from '../../entities/assessments/report-card-result'

export interface ReportCardResultServiceArgs {
  atomicExecution: AtomicExecutionPort
  studentRepository: StudentRepositories['students']
  classGroupRepository: AcademicsRepositories['classGroups']
  StudentClassEnrollmentRepository: StudentRepositories['enrollments']
  academicPeriodRepository: SetupRepositories['academicPeriods']
  assessmentRepository: AssessmentRepositories['assessments']
  gradeRepository: AssessmentRepositories['grades']
  reportCardDefinitionRepository: AssessmentRepositories['definitions']
  reportCardResultRepository: AssessmentRepositories['results']
  attendanceService: Pick<AttendanceService, 'buildAttendanceSummary'>
  gradeService: GradeService
}

export class ReportCardResultService {
  constructor(args: ReportCardResultServiceArgs) {
    this.atomicExecution = args.atomicExecution
    this.students = args.studentRepository
    this.classGroups = args.classGroupRepository
    this.enrollments = args.StudentClassEnrollmentRepository
    this.academicPeriods = args.academicPeriodRepository
    this.assessments = args.assessmentRepository
    this.grades = args.gradeRepository
    this.reportCardDefinitions = args.reportCardDefinitionRepository
    this.reportCardResults = args.reportCardResultRepository
    this.attendance = args.attendanceService
    this.gradeService = args.gradeService
  }

  private readonly atomicExecution: AtomicExecutionPort
  private readonly students: StudentRepositories['students']
  private readonly classGroups: AcademicsRepositories['classGroups']
  private readonly enrollments: StudentRepositories['enrollments']
  private readonly academicPeriods: SetupRepositories['academicPeriods']
  private readonly assessments: AssessmentRepositories['assessments']
  private readonly grades: AssessmentRepositories['grades']
  private readonly reportCardDefinitions: AssessmentRepositories['definitions']
  private readonly reportCardResults: AssessmentRepositories['results']
  private readonly attendance: Pick<AttendanceService, 'buildAttendanceSummary'>
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
    return this.atomicExecution.execute(async () => {
      const generated = await this.generateReportCardResult({ id, studentId, periodId, reportCardDefinitionId, examId })
      const published = generated.copyWith({
        status: ReportCardResultStatus.Published,
        publishedAt: publishedAt ?? new Date(),
      })
      await this.reportCardResults.save(published)
      return published
    })
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
  }): Promise<StudentClassEnrollment> {
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
