import type { AcademicPeriod } from '$lib/core/entities/core/academic-period'
import type { Assessment } from '$lib/core/entities/assessments/assessment'
import type { Module } from '$lib/core/entities/academics/module'
import type { AcademicPeriodRepository } from '$lib/core/ports/academic-period-repository'
import type { AssessmentRepository } from '$lib/core/ports/assessment-repository'
import type { ClassroomRepository } from '$lib/core/ports/classroom-repository'
import type { GradeRepository } from '$lib/core/ports/grade-repository'
import type { ModuleRepository } from '$lib/core/ports/module-repository'
import type { StudentEnrollmentRepository } from '$lib/core/ports/student-enrollment-repository'
import type { StudentRepository } from '$lib/core/ports/student-repository'
import type { SubjectRepository } from '$lib/core/ports/subject-repository'
import { Grade } from '$lib/core/entities/assessments/grade'
import { ModuleNodeKind } from '$lib/core/entities/academics/module'
import { ModuleResult } from '$lib/core/entities/assessments/module-result'
import { roundTo2 } from '$lib/core/validation'

export interface GradeServiceArgs {
  studentRepository: StudentRepository
  studentEnrollmentRepository: StudentEnrollmentRepository
  subjectRepository: SubjectRepository
  assessmentRepository: AssessmentRepository
  academicPeriodRepository: AcademicPeriodRepository
  gradeRepository: GradeRepository
  classroomRepository: ClassroomRepository
  moduleRepository: ModuleRepository
}

export class GradeService {
  constructor(args: GradeServiceArgs) {
    this.students = args.studentRepository
    this.enrollments = args.studentEnrollmentRepository
    this.subjects = args.subjectRepository
    this.assessments = args.assessmentRepository
    this.academicPeriods = args.academicPeriodRepository
    this.grades = args.gradeRepository
    this.classrooms = args.classroomRepository
    this.modules = args.moduleRepository
  }

  private readonly students: StudentRepository
  private readonly enrollments: StudentEnrollmentRepository
  private readonly subjects: SubjectRepository
  private readonly assessments: AssessmentRepository
  private readonly classrooms: ClassroomRepository
  private readonly academicPeriods: AcademicPeriodRepository
  private readonly grades: GradeRepository
  private readonly modules: ModuleRepository

  /**
   * Records a grade for a student against a leaf-level Module.
   * Validates that the module belongs to a classroom the student is enrolled in,
   * and that the period belongs to the same academic year as that classroom.
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
    const module = await this.requireModule(assessment.moduleId)
    const period = await this.requirePeriod(assessment.periodId)
    const classroom = await this.classrooms.findById(module.classroomId)
    if (!classroom || period.academicYearId !== classroom.academicYearId || assessment.classroomId !== classroom.id) {
      throw new Error(`Assessment ${assessmentId} does not belong to academic period ${assessment.periodId}`)
    }
    await this.requireEnrollmentForClassroom({ studentId, classroomId: module.classroomId })

    const existingGrades = await this.grades.listByAssessment(assessmentId)
    const existing = existingGrades.find(grade => grade.studentId === studentId)
    const grade = new Grade({
      id: existing?.id ?? id,
      studentId,
      assessmentId,
      moduleId: assessment.moduleId,
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
   * Builds a hierarchical tree of ModuleResult nodes for a student's report card.
   * Fetches all modules for the student's classroom and recursively computes
   * weighted averages, producing only root-level results (each may have subResults).
   */
  async buildReportCardResults({
    studentId,
    periodId,
    classroomId,
  }: {
    studentId: string
    periodId: string
    classroomId: string
  }): Promise<{
    moduleResults: ModuleResult[]
    overallAverage?: number
  }> {
    const student = await this.students.findById(studentId)
    if (!student) {
      throw new Error(`Unknown student: ${studentId}`)
    }
    await this.requirePeriod(periodId)

    const grades = await this.grades.listByStudentAndPeriod(studentId, periodId)
    // Map moduleId -> grades for O(1) access during tree traversal
    const gradesByModule = new Map<string, Grade[]>()
    for (const grade of grades) {
      gradesByModule.set(grade.moduleId, [...(gradesByModule.get(grade.moduleId) ?? []), grade])
    }

    const allModules = await this.modules.listByClassroom(classroomId)
    /**
     * Recursively computes the ModuleResult for a given module node.
     * Returns null if no grades exist anywhere in the subtree.
     */
    const computeNode = async (module: Module): Promise<ModuleResult | null> => {
      const childModules = allModules.filter(m => m.parentModuleId === module.id)

      // Leaf node: grades are recorded directly here
      if (childModules.length === 0) {
        const leafGrades = gradesByModule.get(module.id) ?? []
        if (leafGrades.length === 0)
          return null
        const totalWeight = leafGrades.reduce((sum, g) => sum + g.coefficient, 0)
        const weightedPoints = leafGrades.reduce((sum, g) => sum + g.weightedPoints, 0)
        const average = totalWeight === 0 ? 0 : weightedPoints / totalWeight
        // Resolve display name: prefer linked subject name, fallback to module name
        let name = module.name ?? ''
        if (module.subjectId) {
          const subject = await this.subjects.findById(module.subjectId)
          if (subject)
            name = subject.name
        }
        return new ModuleResult({
          moduleId: module.id,
          nodeKind: ModuleNodeKind.Subject,
          name: name || module.id,
          average,
          weight: module.weight,
          parentModuleId: module.parentModuleId,
          subjectId: module.subjectId,
          subResults: [],
        })
      }

      // Grouping node: average is weighted average of child results
      const childResults: ModuleResult[] = []
      let sumWeights = 0
      let sumWeightedPoints = 0

      for (const child of childModules) {
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
      const name = module.name ?? module.id
      return new ModuleResult({
        moduleId: module.id,
        nodeKind: ModuleNodeKind.Group,
        name,
        average,
        weight: module.weight,
        parentModuleId: module.parentModuleId,
        subjectId: module.subjectId,
        subResults: childResults,
      })
    }

    // Compute only root-level modules
    const rootModules = allModules.filter(m => !m.parentModuleId)
    const moduleResults: ModuleResult[] = []
    let rootSumWeights = 0
    let rootSumWeightedPoints = 0

    for (const root of rootModules) {
      const result = await computeNode(root)
      if (result) {
        moduleResults.push(result)
        rootSumWeights += root.weight
        rootSumWeightedPoints += result.average * root.weight
      }
    }

    const overallAverage
      = rootSumWeights > 0 ? roundTo2(rootSumWeightedPoints / rootSumWeights) : undefined

    return { moduleResults, overallAverage }
  }

  async listModuleGradesForPeriod({
    moduleId,
    periodId,
  }: {
    moduleId: string
    periodId: string
  }): Promise<Grade[]> {
    const module = await this.requireModule(moduleId)
    const period = await this.requirePeriod(periodId)
    const classroom = await this.classrooms.findById(module.classroomId)
    if (!classroom || classroom.academicYearId !== period.academicYearId) {
      throw new Error(`Module ${moduleId} does not belong to academic period ${periodId}`)
    }
    return this.grades.listByModuleAndPeriod(moduleId, periodId)
  }

  private async requireStudent(studentId: string): Promise<void> {
    const student = await this.students.findById(studentId)
    if (!student) {
      throw new Error(`Unknown student: ${studentId}`)
    }
  }

  private async requireModule(moduleId: string): Promise<Module> {
    const module = await this.modules.findById(moduleId)
    if (!module) {
      throw new Error(`Unknown module: ${moduleId}`)
    }
    return module
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

  private async requireEnrollmentForClassroom({
    studentId,
    classroomId,
  }: {
    studentId: string
    classroomId: string
  }): Promise<void> {
    const enrollments = await this.enrollments.listByStudent(studentId)
    const enrollment = enrollments.find(e => e.classroomId === classroomId)
    if (!enrollment) {
      throw new Error(`Student ${studentId} is not enrolled in classroom ${classroomId}`)
    }
  }
}
