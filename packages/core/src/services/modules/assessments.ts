import type { AssessmentKind } from '../../entities/assessments/assessment'
import type { DeadlineComplianceStatus } from '../../entities/assessments/grade'
import type { GradeScaleArgs } from '../../entities/assessments/grade-scale'
import type { ReportCardDefinitionArgs } from '../../entities/assessments/report-card-definition'
import type { ReportCardDefinitionSectionKind } from '../../entities/assessments/report-card-definition-section'
import type { AcademicPeriod } from '../../entities/school/academic-period'
import type { ClassGroup } from '../../entities/school/class-group'
import type { Student } from '../../entities/students/student'
import type { StudentClassEnrollment } from '../../entities/students/student-class-enrollment'
import type { AtomicExecutionPort } from '../../ports/atomic-execution'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { AuthorizedServiceArgs } from '../authorization'
import type { ServiceArgs } from '../school-headless-app'
import { Assessment } from '../../entities/assessments/assessment'
import { Grade } from '../../entities/assessments/grade'
import { GradeScale } from '../../entities/assessments/grade-scale'
import { ReportCardDefinition } from '../../entities/assessments/report-card-definition'
import { ReportCardDefinitionSection, ReportCardDefinitionSectionKind as SectionKind } from '../../entities/assessments/report-card-definition-section'
import { ReportCardResult, ReportCardResultStatus } from '../../entities/assessments/report-card-result'
import { ReportCardResultSection as SectionResult } from '../../entities/assessments/report-card-result-section'
import { AttendanceStatus } from '../../entities/scheduling/attendance-record'
import { normalizeDate, roundTo2 } from '../../entities/utils'
import { AttendanceSummary } from '../../value_object/attendance-summary'
import { denyResourceAccess, resolveAuditActorId } from '../authorization'

interface CreateAssessmentInput {
  id: string
  classGroupId: string
  classSubjectId: string
  periodId: string
  title: string
  kind: AssessmentKind
  maxScore: number
  coefficient?: number
  sessionId?: string
  dueAt?: Date
  createdAt?: Date
}

interface GenerateReportCardResultInput {
  id: string
  studentId: string
  periodId: string
  reportCardDefinitionId?: string
  examId?: string
  generatedAt?: Date
}

interface PublishReportCardResultInput {
  id: string
  studentId: string
  periodId: string
  reportCardDefinitionId?: string
  examId?: string
  publishedAt?: Date
}

export class AssessmentsService {
  constructor(args: ServiceArgs) {
    this.atomicExecution = args.atomicExecution
    this.actor = args.actor
    this.authorizationPolicy = args.authorizationPolicy
    this.repositories = args.repositories
  }

  private readonly atomicExecution: AtomicExecutionPort
  private readonly actor: AuthorizedServiceArgs['actor']
  private readonly authorizationPolicy: AuthorizedServiceArgs['authorizationPolicy']
  private readonly repositories: SchoolRepositories

  async createGradeScale(input: GradeScaleArgs): Promise<GradeScale> {
    await this.authorize('assessments.manage_configuration', { schoolId: input.schoolId })
    await this.requireSchool(input.schoolId)
    if (input.isDefault) {
      const existingDefault = await this.repositories.gradeScales.findDefaultBySchool(input.schoolId)
      if (existingDefault && existingDefault.id !== input.id) {
        throw new Error(`School ${input.schoolId} already has a default grade scale`)
      }
    }
    const gradeScale = new GradeScale(input)
    await this.repositories.gradeScales.save(gradeScale)
    return gradeScale
  }

  async createReportCardDefinition(input: ReportCardDefinitionArgs): Promise<ReportCardDefinition> {
    await this.authorize('assessments.manage_configuration', {
      schoolId: input.schoolId,
      academicYearId: input.academicYearId,
    })
    await this.requireSchool(input.schoolId)
    const academicYear = await this.repositories.academicYears.findById(input.academicYearId)
    if (!academicYear || academicYear.schoolId !== input.schoolId) {
      denyResourceAccess()
    }
    const gradeLevel = await this.repositories.gradeLevels.findById(input.gradeLevelId)
    if (!gradeLevel || gradeLevel.schoolId !== input.schoolId) {
      denyResourceAccess()
    }
    if (input.isDefault) {
      const existingDefault = await this.repositories.definitions.findDefaultByGradeLevel(
        input.gradeLevelId,
        input.academicYearId,
      )
      if (existingDefault && existingDefault.id !== input.id) {
        throw new Error(`Grade level ${input.gradeLevelId} already has a default report card definition`)
      }
    }
    const definition = new ReportCardDefinition(input)
    await this.repositories.definitions.save(definition)
    return definition
  }

  async createAssessment(input: CreateAssessmentInput): Promise<Assessment> {
    const classGroup = await this.requireClassGroup(input.classGroupId)
    await this.authorize('assessments.record_grade', {
      schoolId: classGroup.schoolId,
      classGroupId: classGroup.id,
      classSubjectId: input.classSubjectId,
    })
    await this.requireAssessmentConfigurationResources(input, classGroup.id, classGroup.schoolId, classGroup.academicYearId)
    const assessment = new Assessment({
      ...input,
      coefficient: input.coefficient ?? 1,
    })
    await this.repositories.assessments.save(assessment)
    return assessment
  }

  async completeAssessment({
    assessmentId,
    metAt,
  }: {
    assessmentId: string
    metAt?: Date
  }): Promise<Assessment> {
    const existing = await this.requireAssessment(assessmentId)
    const classGroup = await this.requireClassGroup(existing.classGroupId)
    await this.authorize('assessments.record_grade', {
      schoolId: classGroup.schoolId,
      classGroupId: classGroup.id,
      classSubjectId: existing.classSubjectId,
    })
    const completed = new Assessment({
      id: existing.id,
      classGroupId: existing.classGroupId,
      classSubjectId: existing.classSubjectId,
      periodId: existing.periodId,
      title: existing.title,
      kind: existing.kind,
      maxScore: existing.maxScore,
      coefficient: existing.coefficient,
      examId: existing.examId,
      sessionId: existing.sessionId,
      dueAt: existing.dueAt,
      metAt: metAt ?? new Date(),
      date: existing.date,
      createdAt: existing.createdAt,
    })
    await this.repositories.assessments.save(completed)
    return completed
  }

  async recordGrade({
    id,
    studentId,
    assessmentId,
    score,
    createdAt,
  }: {
    id: string
    studentId: string
    assessmentId: string
    score: number
    createdAt?: Date
  }): Promise<Grade> {
    const assessment = await this.requireAssessment(assessmentId)
    const classGroup = await this.requireClassGroup(assessment.classGroupId)
    await this.authorize('assessments.record_grade', {
      schoolId: classGroup.schoolId,
      classGroupId: classGroup.id,
      classSubjectId: assessment.classSubjectId,
      studentId,
    })
    await this.requireStudentInSchool(studentId, classGroup.schoolId)
    const period = await this.requirePeriod(assessment.periodId)
    if (period.academicYearId !== classGroup.academicYearId) {
      throw new Error(`Assessment ${assessmentId} does not belong to academic period ${assessment.periodId}`)
    }
    await this.requireStudentEligibilityForAssessment({ studentId, classGroupId: classGroup.id })

    const existingGrades = await this.repositories.grades.list({ assessmentId })
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
      createdBy: resolveAuditActorId(this.actor),
      createdAt: existing?.createdAt ?? createdAt,
    })
    await this.repositories.grades.save(grade)
    return grade
  }

  async recordGradeCompliance({
    id,
    studentId,
    assessmentId,
    status,
    notes,
    createdAt,
  }: {
    id: string
    studentId: string
    assessmentId: string
    status: DeadlineComplianceStatus
    notes?: string | null
    createdAt?: Date
  }): Promise<Grade> {
    const assessment = await this.requireAssessment(assessmentId)
    const classGroup = await this.requireClassGroup(assessment.classGroupId)
    await this.authorize('assessments.record_grade', {
      schoolId: classGroup.schoolId,
      classGroupId: classGroup.id,
      classSubjectId: assessment.classSubjectId,
      studentId,
    })
    await this.requireStudentInSchool(studentId, classGroup.schoolId)
    await this.requireStudentEligibilityForAssessment({ studentId, assessment })
    const existingGrades = await this.repositories.grades.list({ assessmentId })
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
      createdBy: resolveAuditActorId(this.actor),
      createdAt: existing?.createdAt ?? createdAt,
    })
    await this.repositories.grades.save(grade)
    return grade
  }

  async listClassSubjectGradesForPeriod({
    classSubjectId,
    periodId,
  }: {
    classSubjectId: string
    periodId: string
  }): Promise<Grade[]> {
    const classSubject = await this.requireClassSubject(classSubjectId)
    const classGroup = await this.requireClassGroup(classSubject.classGroupId)
    await this.authorize('assessments.read_grades', {
      schoolId: classGroup.schoolId,
      classGroupId: classGroup.id,
      classSubjectId: classSubject.id,
    })
    const period = await this.repositories.academicPeriods.findById(periodId)
    if (!period || period.schoolId !== classGroup.schoolId || period.academicYearId !== classGroup.academicYearId) {
      denyResourceAccess()
    }
    return this.repositories.grades.list({ classSubjectId, periodId })
  }

  async createReportCardDefinitionSection({
    id,
    reportCardDefinitionId,
    kind,
    name,
    weight,
    parentSectionId,
    subjectId,
    createdAt,
  }: {
    id: string
    reportCardDefinitionId: string
    kind: ReportCardDefinitionSectionKind
    name: string
    weight: number
    parentSectionId?: string
    subjectId?: string
    createdAt?: Date
  }): Promise<ReportCardDefinitionSection> {
    const definition = await this.repositories.definitions.findById(reportCardDefinitionId)
    if (!definition) {
      denyResourceAccess()
    }
    await this.authorize('assessments.manage_configuration', {
      schoolId: definition.schoolId,
      academicYearId: definition.academicYearId,
    })
    if (parentSectionId) {
      const parent = await this.repositories.sections.findById(parentSectionId)
      if (!parent || parent.reportCardDefinitionId !== reportCardDefinitionId) {
        denyResourceAccess()
      }
    }
    const section = new ReportCardDefinitionSection({
      id,
      reportCardDefinitionId,
      kind,
      name,
      weight,
      parentSectionId,
      subjectId,
      createdAt,
    })
    await this.repositories.sections.save(section)
    return section
  }

  async generateReportCardResult(input: GenerateReportCardResultInput): Promise<ReportCardResult> {
    const student = await this.requireStudent(input.studentId)
    await this.authorize('assessments.publish_report_card', {
      schoolId: student.schoolId,
      studentId: student.id,
    })
    await this.requireReportCardResources(input.periodId, input.reportCardDefinitionId, student.schoolId)
    return this.buildReportCardResult(input)
  }

  async publishReportCardResult(input: PublishReportCardResultInput): Promise<ReportCardResult> {
    const student = await this.requireStudent(input.studentId)
    await this.authorize('assessments.publish_report_card', {
      schoolId: student.schoolId,
      studentId: student.id,
      reportCardResultId: input.id,
    })
    await this.requireReportCardResources(input.periodId, input.reportCardDefinitionId, student.schoolId)
    return this.atomicExecution.execute(async () => {
      const generated = await this.buildReportCardResult(input)
      const published = generated.copyWith({
        status: ReportCardResultStatus.Published,
        publishedAt: input.publishedAt ?? new Date(),
      })
      await this.repositories.results.save(published)
      return published
    })
  }

  private async buildReportCardResult({
    id,
    studentId,
    periodId,
    reportCardDefinitionId,
    examId,
    generatedAt,
  }: GenerateReportCardResultInput): Promise<ReportCardResult> {
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
    const { sectionResults, overallAverage } = await this.buildReportCardResults({
      studentId,
      periodId,
      classGroupId: classGroup.id,
      reportCardDefinitionId: definition.id,
      examId,
    })
    const periodGrades = await this.repositories.grades.list({ studentId, periodId })
    const grades = examId ? await this.filterGradesByExam(periodGrades, examId) : periodGrades
    const attendanceSummary = await this.buildAttendanceSummary({
      studentId,
      startDate: period.startDate,
      endDate: period.endDate,
    })
    const existing = examId
      ? await this.repositories.results.findByStudentAndExam(studentId, examId)
      : await this.repositories.results.findByStudentAndPeriod(studentId, periodId)
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
    await this.repositories.results.save(reportCard)
    return reportCard
  }

  private async buildReportCardResults({
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
  }): Promise<{ sectionResults: SectionResult[], overallAverage?: number }> {
    await this.requirePeriod(periodId)
    const periodGrades = await this.repositories.grades.list({ studentId, periodId })
    const grades = examId ? await this.filterGradesByExam(periodGrades, examId) : periodGrades
    const gradesByClassSubject = new Map<string, Grade[]>()
    for (const grade of grades) {
      gradesByClassSubject.set(grade.classSubjectId, [
        ...(gradesByClassSubject.get(grade.classSubjectId) ?? []),
        grade,
      ])
    }
    const classSubjects = await this.repositories.classSubjects.list({ classGroupId })
    const classSubjectBySubject = new Map(classSubjects.map(classSubject => [classSubject.subjectId, classSubject]))
    const allSections = await this.repositories.sections.list({ reportCardDefinitionId })
    const computeNode = async (section: ReportCardDefinitionSection): Promise<SectionResult | null> => {
      const childSections = allSections.filter(item => item.parentSectionId === section.id)
      if (section.kind === SectionKind.Subject) {
        const classSubject = section.subjectId ? classSubjectBySubject.get(section.subjectId) : undefined
        if (!classSubject)
          return null
        const leafGrades = (gradesByClassSubject.get(classSubject.id) ?? []).filter(grade => grade.score !== undefined)
        if (leafGrades.length === 0)
          return null
        const totalWeight = leafGrades.reduce((sum, grade) => sum + (grade.coefficient ?? 1), 0)
        const weightedPoints = leafGrades.reduce((sum, grade) => sum + (grade.weightedPoints ?? 0), 0)
        return new SectionResult({
          sectionId: section.id,
          sectionKind: SectionKind.Subject,
          name: section.name,
          average: totalWeight === 0 ? 0 : weightedPoints / totalWeight,
          weight: section.weight,
          parentSectionId: section.parentSectionId,
          classSubjectId: classSubject.id,
          subResults: [],
        })
      }
      const childResults: SectionResult[] = []
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
      return new SectionResult({
        sectionId: section.id,
        sectionKind: SectionKind.Group,
        name: section.name,
        average: sumWeights === 0 ? 0 : sumWeightedPoints / sumWeights,
        weight: section.weight,
        parentSectionId: section.parentSectionId,
        subResults: childResults,
      })
    }
    const sectionResults: SectionResult[] = []
    let rootSumWeights = 0
    let rootSumWeightedPoints = 0
    for (const root of allSections.filter(section => !section.parentSectionId)) {
      const result = await computeNode(root)
      if (result) {
        sectionResults.push(result)
        rootSumWeights += root.weight
        rootSumWeightedPoints += result.average * root.weight
      }
    }
    const overallAverage = rootSumWeights > 0 ? roundTo2(rootSumWeightedPoints / rootSumWeights) : undefined
    return { sectionResults, overallAverage }
  }

  private async buildAttendanceSummary({
    studentId,
    startDate,
    endDate,
  }: {
    studentId: string
    startDate: Date
    endDate: Date
  }): Promise<AttendanceSummary> {
    const records = await this.repositories.attendance.list({
      studentId,
      date: { $gte: normalizeDate(startDate), $lte: normalizeDate(endDate) },
    })
    let presentCount = 0
    let absenceCount = 0
    let lateCount = 0
    for (const record of records) {
      switch (record.status) {
        case AttendanceStatus.Present:
          presentCount += 1
          break
        case AttendanceStatus.Absent:
          absenceCount += 1
          break
        case AttendanceStatus.Late:
          lateCount += 1
          break
      }
    }
    return new AttendanceSummary({ presentCount, absenceCount, lateCount })
  }

  private async filterGradesByExam(grades: readonly Grade[], examId: string): Promise<Grade[]> {
    const filtered: Grade[] = []
    for (const grade of grades) {
      const assessment = await this.repositories.assessments.findById(grade.assessmentId)
      if (assessment?.examId === examId) {
        filtered.push(grade)
      }
    }
    return filtered
  }

  private async requireSchool(schoolId: string): Promise<void> {
    if (!await this.repositories.schools.findById(schoolId)) {
      throw new Error(`Unknown school: ${schoolId}`)
    }
  }

  private async requireStudent(studentId: string): Promise<Student> {
    const student = await this.repositories.students.findById(studentId)
    if (!student) {
      denyResourceAccess()
    }
    return student
  }

  private async requirePeriod(periodId: string): Promise<AcademicPeriod> {
    const period = await this.repositories.academicPeriods.findById(periodId)
    if (!period) {
      throw new Error(`Unknown period: ${periodId}`)
    }
    return period
  }

  private async requireClassGroup(classGroupId: string): Promise<ClassGroup> {
    const classGroup = await this.repositories.classGroups.findById(classGroupId)
    if (!classGroup) {
      denyResourceAccess()
    }
    return classGroup
  }

  private async requireClassSubject(classSubjectId: string) {
    const classSubject = await this.repositories.classSubjects.findById(classSubjectId)
    if (!classSubject) {
      denyResourceAccess()
    }
    return classSubject
  }

  private async requireAssessment(assessmentId: string): Promise<Assessment> {
    const assessment = await this.repositories.assessments.findById(assessmentId)
    if (!assessment) {
      denyResourceAccess()
    }
    return assessment
  }

  private async requireStudentInSchool(studentId: string, schoolId: string): Promise<void> {
    const student = await this.repositories.students.findById(studentId)
    if (!student || student.schoolId !== schoolId) {
      denyResourceAccess()
    }
  }

  private async requireStudentEligibilityForAssessment({
    studentId,
    classGroupId,
    assessment,
  }: {
    studentId: string
    classGroupId?: string
    assessment?: Assessment
  }): Promise<void> {
    const enrollments = await this.repositories.enrollments.list({ studentId })
    const targetClassGroupId = classGroupId ?? assessment?.classGroupId
    if (!targetClassGroupId || !enrollments.some(enrollment => enrollment.classGroupId === targetClassGroupId)) {
      throw new Error(`Student ${studentId} is not enrolled in classGroup ${targetClassGroupId}`)
    }
  }

  private async requireEnrollmentForPeriod({
    studentId,
    academicYearId,
  }: {
    studentId: string
    academicYearId: string
  }): Promise<StudentClassEnrollment> {
    const enrollments = await this.repositories.enrollments.list({ studentId })
    for (const enrollment of enrollments) {
      const classGroup = await this.repositories.classGroups.findById(enrollment.classGroupId)
      if (classGroup?.academicYearId === academicYearId) {
        return enrollment
      }
    }
    throw new Error(`Student ${studentId} is not enrolled in academic year ${academicYearId}`)
  }

  private async requireReportCardDefinition(reportCardDefinitionId: string) {
    const definition = await this.repositories.definitions.findById(reportCardDefinitionId)
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
    const definition = await this.repositories.definitions.findDefaultByGradeLevel(gradeLevelId, academicYearId)
    if (!definition) {
      throw new Error(`No default report card definition for grade level ${gradeLevelId}`)
    }
    return definition
  }

  private async requireAssessmentConfigurationResources(
    input: CreateAssessmentInput,
    classGroupId: string,
    schoolId: string,
    academicYearId: string,
  ): Promise<void> {
    const [classSubject, period, session] = await Promise.all([
      this.repositories.classSubjects.findById(input.classSubjectId),
      this.repositories.academicPeriods.findById(input.periodId),
      input.sessionId ? this.repositories.sessions.findById(input.sessionId) : Promise.resolve(undefined),
    ])
    if (
      !classSubject
      || classSubject.classGroupId !== classGroupId
      || !period
      || period.schoolId !== schoolId
      || period.academicYearId !== academicYearId
      || (input.sessionId && (
        !session
        || session.classGroupId !== classGroupId
        || (session.classSubjectId && session.classSubjectId !== input.classSubjectId)
      ))
    ) {
      denyResourceAccess()
    }
  }

  private async requireReportCardResources(
    periodId: string,
    reportCardDefinitionId: string | undefined,
    schoolId: string,
  ): Promise<void> {
    const period = await this.repositories.academicPeriods.findById(periodId)
    const definition = reportCardDefinitionId
      ? await this.repositories.definitions.findById(reportCardDefinitionId)
      : undefined
    if (!period || period.schoolId !== schoolId || (reportCardDefinitionId && !definition)) {
      denyResourceAccess()
    }
    if (definition && definition.schoolId !== schoolId) {
      denyResourceAccess()
    }
  }

  private async authorize(
    action: 'assessments.manage_configuration' | 'assessments.record_grade' | 'assessments.read_grades' | 'assessments.publish_report_card',
    resource: {
      schoolId: string
      academicYearId?: string
      classGroupId?: string
      classSubjectId?: string
      studentId?: string
      reportCardResultId?: string
    },
  ): Promise<void> {
    await this.authorizationPolicy.requirePermission(this.actor, { action, resource })
  }
}
