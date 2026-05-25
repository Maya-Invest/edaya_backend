import type { GradeScaleArgs } from '../../entities/assessments/grade-scale'
import type { ReportCardDefinitionArgs } from '../../entities/assessments/report-card-definition'
import type { AcademicPeriodRepository } from '../../ports/academic-period-repository'
import type { AcademicYearRepository } from '../../ports/academic-year-repository'
import type { AssessmentRepository } from '../../ports/assessment-repository'
import type { ClassGroupRepository } from '../../ports/class-group-repository'
import type { ClassSubjectRepository } from '../../ports/class-subject-repository'
import type { GradeLevelRepository } from '../../ports/grade-level-repository'
import type { GradeRepository } from '../../ports/grade-repository'
import type { GradeScaleRepository } from '../../ports/grade-scale-repository'
import type { ReportCardDefinitionRepository } from '../../ports/report-card-definition-repository'
import type { ReportCardDefinitionSectionRepository } from '../../ports/report-card-definition-section-repository'
import type { ReportCardResultRepository } from '../../ports/report-card-result-repository'
import type { SchoolRepository } from '../../ports/school-repository'
import type { SessionRepository } from '../../ports/session-repository'
import type { StudentClassEnrollmentRepository } from '../../ports/student-enrollment-repository'
import type { StudentRepository } from '../../ports/student-repository'
import type { AttendanceService } from '../planing/attendance'
import { GradeScale } from '../../entities/assessments/grade-scale'
import { ReportCardDefinition } from '../../entities/assessments/report-card-definition'
import { AssessmentService } from './assessment'
import { GradeService } from './grade'
import { ReportCardDefinitionSectionService } from './report-card-definition-section'
import { ReportCardResultService } from './report-card-result'

export interface AssessmentsServiceArgs {
  schoolRepository: SchoolRepository
  academicYearRepository: AcademicYearRepository
  gradeLevelRepository: GradeLevelRepository
  studentRepository: StudentRepository
  StudentClassEnrollmentRepository: StudentClassEnrollmentRepository
  classGroupRepository: ClassGroupRepository
  classSubjectRepository: ClassSubjectRepository
  academicPeriodRepository: AcademicPeriodRepository
  sessionRepository: SessionRepository
  assessmentRepository: AssessmentRepository
  gradeRepository: GradeRepository
  gradeScaleRepository: GradeScaleRepository
  reportCardDefinitionRepository: ReportCardDefinitionRepository
  reportCardDefinitionSectionRepository: ReportCardDefinitionSectionRepository
  reportCardResultRepository: ReportCardResultRepository
  attendanceService: AttendanceService
}

export class AssessmentsService {
  private readonly schools: SchoolRepository
  private readonly academicYears: AcademicYearRepository
  private readonly gradeLevels: GradeLevelRepository
  private readonly gradeScales: GradeScaleRepository
  private readonly reportCardDefinitions: ReportCardDefinitionRepository
  private readonly assessments: AssessmentService
  private readonly grades: GradeService
  private readonly reportCardDefinitionSections: ReportCardDefinitionSectionService
  private readonly reportCardResults: ReportCardResultService

  constructor(args: AssessmentsServiceArgs) {
    this.schools = args.schoolRepository
    this.academicYears = args.academicYearRepository
    this.gradeLevels = args.gradeLevelRepository
    this.gradeScales = args.gradeScaleRepository
    this.reportCardDefinitions = args.reportCardDefinitionRepository
    this.assessments = new AssessmentService(args)
    this.grades = new GradeService(args)
    this.reportCardDefinitionSections = new ReportCardDefinitionSectionService(args)
    this.reportCardResults = new ReportCardResultService({
      ...args,
      gradeService: this.grades,
    })
  }

  async createGradeScale(input: GradeScaleArgs): Promise<GradeScale> {
    await this.requireSchool(input.schoolId)
    if (input.isDefault) {
      const existingDefault = await this.gradeScales.findDefaultBySchool(input.schoolId)
      if (existingDefault && existingDefault.id !== input.id) {
        throw new Error(`School ${input.schoolId} already has a default grade scale`)
      }
    }
    const gradeScale = new GradeScale(input)
    await this.gradeScales.save(gradeScale)
    return gradeScale
  }

  async createReportCardDefinition(input: ReportCardDefinitionArgs): Promise<ReportCardDefinition> {
    await this.requireSchool(input.schoolId)
    const academicYear = await this.academicYears.findById(input.academicYearId)
    if (!academicYear || academicYear.schoolId !== input.schoolId) {
      throw new Error(`Academic year ${input.academicYearId} is not valid for school ${input.schoolId}`)
    }
    const gradeLevel = await this.gradeLevels.findById(input.gradeLevelId)
    if (!gradeLevel || gradeLevel.schoolId !== input.schoolId) {
      throw new Error(`Grade level ${input.gradeLevelId} is not valid for school ${input.schoolId}`)
    }
    if (input.isDefault) {
      const existingDefault = await this.reportCardDefinitions.findDefaultByGradeLevel(
        input.gradeLevelId,
        input.academicYearId,
      )
      if (existingDefault && existingDefault.id !== input.id) {
        throw new Error(`Grade level ${input.gradeLevelId} already has a default report card definition`)
      }
    }
    const definition = new ReportCardDefinition(input)
    await this.reportCardDefinitions.save(definition)
    return definition
  }

  createAssessment(input: Parameters<AssessmentService['createAssessment']>[0]) {
    return this.assessments.createAssessment(input)
  }

  completeAssessment(input: Parameters<AssessmentService['completeAssessment']>[0]) {
    return this.assessments.completeAssessment(input)
  }

  recordGrade(input: Parameters<GradeService['recordGrade']>[0]) {
    return this.grades.recordGrade(input)
  }

  recordGradeCompliance(input: Parameters<GradeService['recordGradeCompliance']>[0]) {
    return this.grades.recordGradeCompliance(input)
  }

  listClassSubjectGradesForPeriod(input: Parameters<GradeService['listClassSubjectGradesForPeriod']>[0]) {
    return this.grades.listClassSubjectGradesForPeriod(input)
  }

  createReportCardDefinitionSection(
    input: Parameters<ReportCardDefinitionSectionService['createReportCardDefinitionSection']>[0],
  ) {
    return this.reportCardDefinitionSections.createReportCardDefinitionSection(input)
  }

  generateReportCardResult(input: Parameters<ReportCardResultService['generateReportCardResult']>[0]) {
    return this.reportCardResults.generateReportCardResult(input)
  }

  publishReportCardResult(input: Parameters<ReportCardResultService['publishReportCardResult']>[0]) {
    return this.reportCardResults.publishReportCardResult(input)
  }

  private async requireSchool(schoolId: string): Promise<void> {
    if (!await this.schools.findById(schoolId)) {
      throw new Error(`Unknown school: ${schoolId}`)
    }
  }
}
