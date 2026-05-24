import type { Assessment } from '$lib/core/entities/assessments/assessment'
import type { ReportCardDefinitionSection } from '$lib/core/entities/assessments/report-card-definition-section'
import type { ReportCardResultSection } from '$lib/core/entities/assessments/report-card-result-section'
import type { AcademicPeriod } from '$lib/core/entities/core/academic-period'
import type { AcademicPeriodRepository } from '$lib/core/ports/academic-period-repository'
import type { AssessmentRepository } from '$lib/core/ports/assessment-repository'
import type { ClassGroupRepository } from '$lib/core/ports/class-group-repository'
import type { ClassSubjectRepository } from '$lib/core/ports/class-subject-repository'
import type { GradeRepository } from '$lib/core/ports/grade-repository'
import type { ReportCardDefinitionSectionRepository } from '$lib/core/ports/report-card-definition-section-repository'
import type { StudentEnrollmentRepository } from '$lib/core/ports/student-enrollment-repository'
import type { StudentRepository } from '$lib/core/ports/student-repository'
import { Grade } from '$lib/core/entities/assessments/grade'
import { ReportCardDefinitionSectionKind } from '$lib/core/entities/assessments/report-card-definition-section'
import { ReportCardResultSection as SectionResult } from '$lib/core/entities/assessments/report-card-result-section'
import { roundTo2 } from '$lib/core/utils/validation'

export interface GradeServiceArgs {
  studentRepository: StudentRepository
  studentEnrollmentRepository: StudentEnrollmentRepository
  assessmentRepository: AssessmentRepository
  classSubjectRepository: ClassSubjectRepository
  academicPeriodRepository: AcademicPeriodRepository
  gradeRepository: GradeRepository
  classGroupRepository: ClassGroupRepository
  reportCardDefinitionSectionRepository: ReportCardDefinitionSectionRepository
}

export class GradeService {
  constructor(args: GradeServiceArgs) {
    this.students = args.studentRepository
    this.enrollments = args.studentEnrollmentRepository
    this.assessments = args.assessmentRepository
    this.classSubjects = args.classSubjectRepository
    this.academicPeriods = args.academicPeriodRepository
    this.grades = args.gradeRepository
    this.classGroups = args.classGroupRepository
    this.sections = args.reportCardDefinitionSectionRepository
  }

  private readonly students: StudentRepository
  private readonly enrollments: StudentEnrollmentRepository
  private readonly assessments: AssessmentRepository
  private readonly classSubjects: ClassSubjectRepository
  private readonly classGroups: ClassGroupRepository
  private readonly academicPeriods: AcademicPeriodRepository
  private readonly grades: GradeRepository
  private readonly sections: ReportCardDefinitionSectionRepository

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
    createdBy,
    createdAt,
  }: {
    id: string
    studentId: string
    assessmentId: string
    score: number
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
      score,
      maxScore: assessment.maxScore,
      coefficient: assessment.coefficient,
      createdBy,
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
        const leafGrades = gradesByClassSubject.get(classSubject.id) ?? []
        if (leafGrades.length === 0)
          return null
        const totalWeight = leafGrades.reduce((sum, g) => sum + g.coefficient, 0)
        const weightedPoints = leafGrades.reduce((sum, g) => sum + g.weightedPoints, 0)
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
}
