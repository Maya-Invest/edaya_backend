import type { Assessment } from '../../entities/assessments/assessment'
import type { DeadlineComplianceStatus } from '../../entities/assessments/grade'
import type { ReportCardDefinitionSection } from '../../entities/assessments/report-card-definition-section'
import type { ReportCardResultSection } from '../../entities/assessments/report-card-result-section'
import type { AcademicPeriod } from '../../entities/school/academic-period'
import type {
  SetupRepositories,
  AcademicsRepositories,
  StudentRepositories,
  AssessmentRepositories,
} from '../../ports/school-repositories'
import { Grade } from '../../entities/assessments/grade'
import { ReportCardDefinitionSectionKind } from '../../entities/assessments/report-card-definition-section'
import { ReportCardResultSection as SectionResult } from '../../entities/assessments/report-card-result-section'
import { roundTo2 } from '../../utils/validation'

export interface GradeServiceArgs {
  studentRepository: StudentRepositories['students']
  StudentClassEnrollmentRepository: StudentRepositories['enrollments']
  assessmentRepository: AssessmentRepositories['assessments']
  classSubjectRepository: AcademicsRepositories['classSubjects']
  academicPeriodRepository: SetupRepositories['academicPeriods']
  gradeRepository: AssessmentRepositories['grades']
  classGroupRepository: AcademicsRepositories['classGroups']
  reportCardDefinitionSectionRepository: AssessmentRepositories['sections']
}

export class GradeService {
  constructor(args: GradeServiceArgs) {
    this.students = args.studentRepository
    this.enrollments = args.StudentClassEnrollmentRepository
    this.assessments = args.assessmentRepository
    this.classSubjects = args.classSubjectRepository
    this.academicPeriods = args.academicPeriodRepository
    this.grades = args.gradeRepository
    this.classGroups = args.classGroupRepository
    this.sections = args.reportCardDefinitionSectionRepository
  }

  private readonly students: StudentRepositories['students']
  private readonly enrollments: StudentRepositories['enrollments']
  private readonly assessments: AssessmentRepositories['assessments']
  private readonly classSubjects: AcademicsRepositories['classSubjects']
  private readonly classGroups: AcademicsRepositories['classGroups']
  private readonly academicPeriods: SetupRepositories['academicPeriods']
  private readonly grades: AssessmentRepositories['grades']
  private readonly sections: AssessmentRepositories['sections']

  /**
   * Records a grade for a student against an assessment's class subject.
   * Validates that the assessment belongs to a classGroup the student is enrolled in,
   * and that the period belongs to the same academic year as that classGroup.
   */
  async recordGrade({
    id,
    studentId,
    assessmentId,
    score,
    status,
    notes,
    createdBy,
    createdAt,
  }: {
    id: string
    studentId: string
    assessmentId: string
    score?: number
    status?: DeadlineComplianceStatus
    notes?: string | null
    createdBy?: string
    createdAt?: Date
  }): Promise<Grade> {
    await this.requireStudent(studentId)
    const assessment = await this.requireAssessment(assessmentId)
    const period = await this.requirePeriod(assessment.periodId)
    const classGroup = await this.classGroups.findById(assessment.classGroupId)
    if (!classGroup || period.academicYearId !== classGroup.academicYearId || assessment.classGroupId !== classGroup.id) {
      throw new Error(`Assessment ${assessmentId} does not belong to academic period ${assessment.periodId}`)
    }
    await this.requireEnrollmentForClassGroup({ studentId, classGroupId: assessment.classGroupId })

    const existingGrades = await this.grades.listByAssessment(assessmentId)
    const existing = existingGrades.find(grade => grade.studentId === studentId)
    const grade = new Grade({
      id: existing?.id ?? id,
      studentId,
      assessmentId,
      classSubjectId: assessment.classSubjectId,
      periodId: assessment.periodId,
      score: score !== undefined ? score : existing?.score,
      maxScore: assessment.maxScore,
      coefficient: assessment.coefficient,
      status: status !== undefined ? status : existing?.status,
      notes: notes !== undefined ? notes : existing?.notes,
      createdBy,
      createdAt: existing?.createdAt ?? createdAt,
    })
    await this.grades.save(grade)
    return grade
  }

  /**
   * Records a student's compliance with an assessment's deadline.
   * Replaces old recordDeadlineCompliance functionality.
   */
  async recordGradeCompliance({
    id,
    studentId,
    assessmentId,
    status,
    notes,
    createdBy,
    createdAt,
  }: {
    id: string
    studentId: string
    assessmentId: string
    status: DeadlineComplianceStatus
    notes?: string | null
    createdBy?: string
    createdAt?: Date
  }): Promise<Grade> {
    await this.requireStudent(studentId)
    const assessment = await this.requireAssessment(assessmentId)
    await this.requireStudentEligibilityForAssessment({ studentId, assessment })

    const existingGrades = await this.grades.listByAssessment(assessmentId)
    const existing = existingGrades.find(grade => grade.studentId === studentId)

    const grade = new Grade({
      id: existing?.id ?? id,
      studentId,
      assessmentId,
      classSubjectId: assessment.classSubjectId,
      periodId: assessment.periodId,
      score: existing?.score,
      maxScore: assessment.maxScore,
      coefficient: assessment.coefficient,
      status,
      notes,
      createdBy: createdBy ?? existing?.createdBy,
      createdAt: existing?.createdAt ?? createdAt,
    })
    await this.grades.save(grade)
    return grade
  }

  /**
   * Builds a hierarchical tree of section result nodes for a student's report card.
   * Fetches all report card sections for the student's classGroup and recursively computes
   * weighted averages, producing only root-level results (each may have subResults).
   */
  async buildReportCardResults({
    studentId,
    periodId,
    classGroupId,
    reportCardDefinitionId,
    examId,
  }: {
    studentId: string
    periodId: string
    classGroupId: string
    reportCardDefinitionId: string
    examId?: string
  }): Promise<{
    sectionResults: ReportCardResultSection[]
    overallAverage?: number
  }> {
    const student = await this.students.findById(studentId)
    if (!student) {
      throw new Error(`Unknown student: ${studentId}`)
    }
    await this.requirePeriod(periodId)

    const periodGrades = await this.grades.listByStudentAndPeriod(studentId, periodId)
    const grades = examId ? await this.filterGradesByExam(periodGrades, examId) : periodGrades
    const gradesByClassSubject = new Map<string, Grade[]>()
    for (const grade of grades) {
      gradesByClassSubject.set(grade.classSubjectId, [
        ...(gradesByClassSubject.get(grade.classSubjectId) ?? []),
        grade,
      ])
    }

    const classSubjects = await this.classSubjects.listByClassGroup(classGroupId)
    const classSubjectBySubject = new Map(classSubjects.map(classSubject => [classSubject.subjectId, classSubject]))
    const allSections = await this.sections.listByReportCardDefinition(reportCardDefinitionId)
    const computeNode = async (section: ReportCardDefinitionSection): Promise<ReportCardResultSection | null> => {
      const childSections = allSections.filter(item => item.parentSectionId === section.id)

      if (section.kind === ReportCardDefinitionSectionKind.Subject) {
        const classSubject = section.subjectId ? classSubjectBySubject.get(section.subjectId) : undefined
        if (!classSubject)
          return null
        const allLeafGrades = gradesByClassSubject.get(classSubject.id) ?? []
        // Filter out ungraded / only compliance-tracked assessments so they don't break average calculations
        const leafGrades = allLeafGrades.filter(g => g.score !== undefined)
        if (leafGrades.length === 0)
          return null
        const totalWeight = leafGrades.reduce((sum, g) => sum + (g.coefficient ?? 1), 0)
        const weightedPoints = leafGrades.reduce((sum, g) => sum + (g.weightedPoints ?? 0), 0)
        const average = totalWeight === 0 ? 0 : weightedPoints / totalWeight
        return new SectionResult({
          sectionId: section.id,
          sectionKind: ReportCardDefinitionSectionKind.Subject,
          name: section.name,
          average,
          weight: section.weight,
          parentSectionId: section.parentSectionId,
          classSubjectId: classSubject.id,
          subResults: [],
        })
      }

      const childResults: ReportCardResultSection[] = []
      let sumWeights = 0
      let sumWeightedPoints = 0

      for (const child of childSections) {
        const childResult = await computeNode(child)
        if (childResult) {
          childResults.push(childResult)
          sumWeights += child.weight
          sumWeightedPoints += childResult.average * child.weight
        }
      }

      if (childResults.length === 0)
        return null

      const average = sumWeights === 0 ? 0 : sumWeightedPoints / sumWeights
      return new SectionResult({
        sectionId: section.id,
        sectionKind: ReportCardDefinitionSectionKind.Group,
        name: section.name,
        average,
        weight: section.weight,
        parentSectionId: section.parentSectionId,
        subResults: childResults,
      })
    }

    const rootSections = allSections.filter(section => !section.parentSectionId)
    const sectionResults: ReportCardResultSection[] = []
    let rootSumWeights = 0
    let rootSumWeightedPoints = 0

    for (const root of rootSections) {
      const result = await computeNode(root)
      if (result) {
        sectionResults.push(result)
        rootSumWeights += root.weight
        rootSumWeightedPoints += result.average * root.weight
      }
    }

    const overallAverage
      = rootSumWeights > 0 ? roundTo2(rootSumWeightedPoints / rootSumWeights) : undefined

    return { sectionResults, overallAverage }
  }

  async listClassSubjectGradesForPeriod({
    classSubjectId,
    periodId,
  }: {
    classSubjectId: string
    periodId: string
  }): Promise<Grade[]> {
    await this.requirePeriod(periodId)
    return this.grades.listByClassSubjectAndPeriod(classSubjectId, periodId)
  }

  private async filterGradesByExam(grades: readonly Grade[], examId: string): Promise<Grade[]> {
    const filtered: Grade[] = []
    for (const grade of grades) {
      const assessment = await this.assessments.findById(grade.assessmentId)
      if (assessment?.examId === examId) {
        filtered.push(grade)
      }
    }
    return filtered
  }

  private async requireStudent(studentId: string): Promise<void> {
    const student = await this.students.findById(studentId)
    if (!student) {
      throw new Error(`Unknown student: ${studentId}`)
    }
  }

  private async requirePeriod(periodId: string): Promise<AcademicPeriod> {
    const period = await this.academicPeriods.findById(periodId)
    if (!period) {
      throw new Error(`Unknown period: ${periodId}`)
    }
    return period
  }

  private async requireAssessment(assessmentId: string): Promise<Assessment> {
    const assessment = await this.assessments.findById(assessmentId)
    if (!assessment) {
      throw new Error(`Unknown assessment: ${assessmentId}`)
    }
    return assessment
  }

  private async requireEnrollmentForClassGroup({
    studentId,
    classGroupId,
  }: {
    studentId: string
    classGroupId: string
  }): Promise<void> {
    const enrollments = await this.enrollments.listByStudent(studentId)
    const enrollment = enrollments.find(e => e.classGroupId === classGroupId)
    if (!enrollment) {
      throw new Error(`Student ${studentId} is not enrolled in classGroup ${classGroupId}`)
    }
  }

  private async requireStudentEligibilityForAssessment({
    studentId,
    assessment,
  }: {
    studentId: string
    assessment: Assessment
  }): Promise<void> {
    const enrollments = await this.enrollments.listByStudent(studentId)
    const targetClassGroupId = assessment.classGroupId
    if (!enrollments.some(enrollment => enrollment.classGroupId === targetClassGroupId)) {
      throw new Error(`Student ${studentId} is not eligible for assessment ${assessment.id}`)
    }
  }
}
