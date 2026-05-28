import type { AssessmentKind } from '../../entities/assessments/assessment'
import type { DeadlineComplianceStatus } from '../../entities/assessments/assessment-result'
import type { ReportCardDefinitionArgs } from '../../entities/assessments/report-card-definition'
import type { ReportCardDefinitionSectionKind } from '../../entities/assessments/report-card-definition-section'
import type { AcademicPeriod } from '../../entities/school/academic-period'
import type { ClassGroup } from '../../entities/school/class-group'
import type { GradeScaleArgs } from '../../entities/school/grade-scale'
import type { Student } from '../../entities/students/student'
import type { StudentClassEnrollment } from '../../entities/students/student-class-enrollment'
import type { AtomicExecutionPort } from '../../ports/atomic-execution'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { AuthorizedServiceArgs } from '../authorization'
import type { ServiceArgs } from '../school-headless-app'
import { Assessment } from '../../entities/assessments/assessment'
import { AssessmentResult } from '../../entities/assessments/assessment-result'
import { ReportCardDefinition } from '../../entities/assessments/report-card-definition'
import { ReportCardDefinitionSection, ReportCardDefinitionSectionKind as SectionKind } from '../../entities/assessments/report-card-definition-section'
import { ReportCardResult, ReportCardResultStatus } from '../../entities/assessments/report-card-result'
import { ReportCardResultSection as SectionResult } from '../../entities/assessments/report-card-result-section'
import { AttendanceJustificationStatus, AttendanceStatus } from '../../entities/scheduling/attendance-record'
import { GradeScale } from '../../entities/school/grade-scale'
import { StudentClassEnrollmentStatus } from '../../entities/students/student-class-enrollment'
import { normalizeDate, roundTo2 } from '../../entities/utils'
import { AttendanceSummary } from '../../value_object/attendance-summary'
import { denyResourceAccess, resolveAuditActorId } from '../authorization'
import { BusinessRuleViolationError } from '../shared/business-rule-error'
import { requireSchool } from '../shared/require-school'

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
  generatedAt?: Date
}

interface PublishReportCardResultInput {
  id: string
  studentId: string
  periodId: string
  reportCardDefinitionId?: string
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
    await requireSchool(this.repositories.schools, input.schoolId)
    if (input.isDefault) {
      const existingDefault = await this.repositories.gradeScales.findDefaultBySchool(input.schoolId)
      if (existingDefault && existingDefault.id !== input.id) {
        throw new BusinessRuleViolationError('DEFAULT_GRADE_SCALE_ALREADY_EXISTS', `School ${input.schoolId} already has a default grade scale`)
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
    await requireSchool(this.repositories.schools, input.schoolId)
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
        throw new BusinessRuleViolationError('DEFAULT_REPORT_CARD_DEFINITION_ALREADY_EXISTS', `Grade level ${input.gradeLevelId} already has a default report card definition`)
      }
    }
    const definition = new ReportCardDefinition(input)
    await this.repositories.definitions.save(definition)
    return definition
  }

  async createAssessment(input: CreateAssessmentInput): Promise<Assessment> {
    const classGroup = await this.requireClassGroup(input.classGroupId)
    await this.authorize('assessments.record_result', {
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
    await this.authorize('assessments.record_result', {
      schoolId: classGroup.schoolId,
      classGroupId: classGroup.id,
      classSubjectId: existing.classSubjectId,
    })
    if ((await this.repositories.assessmentResults.list({ assessmentId })).length > 0) {
      throw new BusinessRuleViolationError('ASSESSMENT_RESULTS_ALREADY_RECORDED', `Assessment ${assessmentId} cannot be changed after results have been recorded`)
    }
    const completed = new Assessment({
      id: existing.id,
      classGroupId: existing.classGroupId,
      classSubjectId: existing.classSubjectId,
      periodId: existing.periodId,
      title: existing.title,
      kind: existing.kind,
      maxScore: existing.maxScore,
      coefficient: existing.coefficient,
      sessionId: existing.sessionId,
      dueAt: existing.dueAt,
      metAt: metAt ?? new Date(),
      date: existing.date,
      createdAt: existing.createdAt,
    })
    await this.repositories.assessments.save(completed)
    return completed
  }

  async recordAssessmentResult({
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
  }): Promise<AssessmentResult> {
    const assessment = await this.requireAssessment(assessmentId)
    const classGroup = await this.requireClassGroup(assessment.classGroupId)
    await this.authorize('assessments.record_result', {
      schoolId: classGroup.schoolId,
      classGroupId: classGroup.id,
      classSubjectId: assessment.classSubjectId,
      studentId,
    })
    await this.requireStudentInSchool(studentId, classGroup.schoolId)
    const period = await this.requirePeriod(assessment.periodId)
    if (period.academicYearId !== classGroup.academicYearId) {
      throw new BusinessRuleViolationError('ASSESSMENT_PERIOD_MISMATCH', `Assessment ${assessmentId} does not belong to academic period ${assessment.periodId}`)
    }
    await this.requireStudentEligibilityForAssessment({ studentId, classGroupId: classGroup.id })
    await this.requireReportCardNotPublished(studentId, assessment.periodId)

    const existingResults = await this.repositories.assessmentResults.list({ assessmentId })
    const existing = existingResults.find(res => res.studentId === studentId)
    const assessmentResult = new AssessmentResult({
      id: existing?.id ?? id,
      studentId,
      assessmentId,
      score,
      status: existing?.status,
      notes: existing?.notes,
      createdBy: resolveAuditActorId(this.actor),
      createdAt: existing?.createdAt ?? createdAt,
    })
    if (assessmentResult.score !== undefined && assessmentResult.score > assessment.maxScore) {
      throw new BusinessRuleViolationError('SCORE_EXCEEDS_MAX_SCORE', 'score must not exceed assessment maxScore')
    }
    await this.repositories.assessmentResults.save(assessmentResult)
    return assessmentResult
  }

  async recordAssessmentResultCompliance({
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
  }): Promise<AssessmentResult> {
    const assessment = await this.requireAssessment(assessmentId)
    const classGroup = await this.requireClassGroup(assessment.classGroupId)
    await this.authorize('assessments.record_result', {
      schoolId: classGroup.schoolId,
      classGroupId: classGroup.id,
      classSubjectId: assessment.classSubjectId,
      studentId,
    })
    await this.requireStudentInSchool(studentId, classGroup.schoolId)
    await this.requireStudentEligibilityForAssessment({ studentId, assessment })
    await this.requireReportCardNotPublished(studentId, assessment.periodId)
    const existingResults = await this.repositories.assessmentResults.list({ assessmentId })
    const existing = existingResults.find(res => res.studentId === studentId)
    const assessmentResult = new AssessmentResult({
      id: existing?.id ?? id,
      studentId,
      assessmentId,
      score: existing?.score,
      status,
      notes,
      createdBy: resolveAuditActorId(this.actor),
      createdAt: existing?.createdAt ?? createdAt,
    })
    await this.repositories.assessmentResults.save(assessmentResult)
    return assessmentResult
  }

  async listClassSubjectAssessmentResultsForPeriod({
    classSubjectId,
    periodId,
  }: {
    classSubjectId: string
    periodId: string
  }): Promise<AssessmentResult[]> {
    const classSubject = await this.requireClassSubject(classSubjectId)
    const classGroup = await this.requireClassGroup(classSubject.classGroupId)
    await this.authorize('assessments.read_results', {
      schoolId: classGroup.schoolId,
      classGroupId: classGroup.id,
      classSubjectId: classSubject.id,
    })
    const period = await this.repositories.academicPeriods.findById(periodId)
    if (!period || period.schoolId !== classGroup.schoolId || period.academicYearId !== classGroup.academicYearId) {
      denyResourceAccess()
    }
    const assessments = await this.repositories.assessments.list({ classSubjectId, periodId })
    const assessmentIds = new Set(assessments.map(assessment => assessment.id))
    return (await this.repositories.assessmentResults.list()).filter(result => assessmentIds.has(result.assessmentId))
  }

  async createReportCardDefinitionSection({
    id,
    reportCardDefinitionId,
    kind,
    name,
    order,
    weight,
    parentSectionId,
    subjectId,
    createdAt,
  }: {
    id: string
    reportCardDefinitionId: string
    kind: ReportCardDefinitionSectionKind
    name: string
    order: number
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
    if (parentSectionId === id) {
      throw new BusinessRuleViolationError('REPORT_CARD_SECTION_SELF_PARENT', 'report card sections must not parent themselves')
    }
    if (parentSectionId) {
      const parent = await this.repositories.sections.findById(parentSectionId)
      if (!parent || parent.reportCardDefinitionId !== reportCardDefinitionId) {
        denyResourceAccess()
      }
      if (parent.kind !== SectionKind.Group) {
        throw new BusinessRuleViolationError('SUBJECT_SECTION_HAS_CHILDREN', 'subject report card sections must not contain child sections')
      }
      await this.requireAcyclicSectionParent(id, parent)
    }
    const section = new ReportCardDefinitionSection({
      id,
      reportCardDefinitionId,
      kind,
      name,
      order,
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
    await this.requireReportCardNotPublished(input.studentId, input.periodId)
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
      await this.requireReportCardNotPublished(input.studentId, input.periodId)
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
    })
    const periodAssessmentResults = await this.listResultsForStudentAndPeriod(studentId, periodId)
    const attendanceSummary = await this.buildAttendanceSummary({
      studentId,
      startDate: period.startDate,
      endDate: period.endDate,
    })
    const existing = await this.repositories.results.findByStudentAndPeriod(studentId, periodId)
    const reportCard = new ReportCardResult({
      id: existing?.id ?? id,
      reportCardDefinitionId: definition.id,
      studentId,
      classGroupId: classGroup.id,
      periodId,
      sectionResults,
      attendanceSummary,
      assessmentResultCount: periodAssessmentResults.length,
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
  }: {
    studentId: string
    periodId: string
    classGroupId: string
    reportCardDefinitionId: string
  }): Promise<{ sectionResults: SectionResult[], overallAverage?: number }> {
    await this.requirePeriod(periodId)
    const periodAssessmentResults = await this.listResultsForStudentAndPeriod(studentId, periodId)
    const assessmentResultsByClassSubject = new Map<string, Array<{ result: AssessmentResult, assessment: Assessment }>>()
    for (const { result, assessment } of periodAssessmentResults) {
      assessmentResultsByClassSubject.set(assessment.classSubjectId, [
        ...(assessmentResultsByClassSubject.get(assessment.classSubjectId) ?? []),
        { result, assessment },
      ])
    }
    const classSubjects = await this.repositories.classSubjects.list({ classGroupId })
    const classSubjectBySubject = new Map(classSubjects.map(classSubject => [classSubject.subjectId, classSubject]))
    const allSections = (await this.repositories.sections.list({ reportCardDefinitionId }))
      .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    const computeNode = async (
      section: ReportCardDefinitionSection,
      visited = new Set<string>(),
    ): Promise<SectionResult | null> => {
      if (visited.has(section.id)) {
        throw new BusinessRuleViolationError('REPORT_CARD_SECTION_CYCLE', 'report card definition sections must not contain cycles')
      }
      const nextVisited = new Set(visited).add(section.id)
      const childSections = allSections.filter(item => item.parentSectionId === section.id)
      if (section.kind === SectionKind.Subject) {
        const classSubject = section.subjectId ? classSubjectBySubject.get(section.subjectId) : undefined
        if (!classSubject)
          return null
        const leafResults = (assessmentResultsByClassSubject.get(classSubject.id) ?? [])
          .filter(({ result }) => result.score !== undefined)
        if (leafResults.length === 0)
          return null
        const totalWeight = leafResults.reduce((sum, { assessment }) => sum + assessment.coefficient, 0)
        const weightedPoints = leafResults.reduce((sum, { result, assessment }) => {
          const normalizedScore = ((result.score ?? 0) / assessment.maxScore) * 20
          return sum + normalizedScore * assessment.coefficient
        }, 0)
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
        const childResult = await computeNode(child, nextVisited)
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
    let excusedAbsenceCount = 0
    let lateCount = 0
    for (const record of records) {
      switch (record.status) {
        case AttendanceStatus.Present:
          presentCount += 1
          break
        case AttendanceStatus.Absent:
          absenceCount += 1
          if (record.justificationStatus === AttendanceJustificationStatus.Excused) {
            excusedAbsenceCount += 1
          }
          break
        case AttendanceStatus.Late:
          lateCount += 1
          break
      }
    }
    return new AttendanceSummary({ presentCount, absenceCount, excusedAbsenceCount, lateCount })
  }

  private async listResultsForStudentAndPeriod(
    studentId: string,
    periodId: string,
  ): Promise<Array<{ result: AssessmentResult, assessment: Assessment }>> {
    const results = await this.repositories.assessmentResults.list({ studentId })
    const resolved: Array<{ result: AssessmentResult, assessment: Assessment }> = []
    for (const result of results) {
      const assessment = await this.repositories.assessments.findById(result.assessmentId)
      if (assessment?.periodId === periodId) {
        resolved.push({ result, assessment })
      }
    }
    return resolved
  }

  private async requireAcyclicSectionParent(
    sectionId: string,
    parent: ReportCardDefinitionSection,
  ): Promise<void> {
    let candidate: ReportCardDefinitionSection | undefined = parent
    while (candidate) {
      if (candidate.id === sectionId) {
        throw new BusinessRuleViolationError('REPORT_CARD_SECTION_CYCLE', 'report card definition sections must not contain cycles')
      }
      candidate = candidate.parentSectionId
        ? await this.repositories.sections.findById(candidate.parentSectionId)
        : undefined
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
      throw new BusinessRuleViolationError('UNKNOWN_PERIOD', `Unknown period: ${periodId}`)
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
    const targetClassGroupId = classGroupId ?? assessment?.classGroupId
    const enrollments = targetClassGroupId
      ? await this.repositories.enrollments.list({
          studentId,
          classGroupId: targetClassGroupId,
          status: StudentClassEnrollmentStatus.Active,
        })
      : []
    if (!targetClassGroupId || enrollments.length === 0) {
      throw new BusinessRuleViolationError('ACTIVE_ENROLLMENT_REQUIRED', `Student ${studentId} does not have an active enrollment in classGroup ${targetClassGroupId}`)
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
    throw new BusinessRuleViolationError('STUDENT_NOT_ENROLLED_IN_YEAR', `Student ${studentId} is not enrolled in academic year ${academicYearId}`)
  }

  private async requireReportCardDefinition(reportCardDefinitionId: string) {
    const definition = await this.repositories.definitions.findById(reportCardDefinitionId)
    if (!definition) {
      throw new BusinessRuleViolationError('UNKNOWN_REPORT_CARD_DEFINITION', `Unknown report card definition: ${reportCardDefinitionId}`)
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
      throw new BusinessRuleViolationError('NO_DEFAULT_REPORT_CARD_DEFINITION', `No default report card definition for grade level ${gradeLevelId}`)
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

  private async requireReportCardNotPublished(studentId: string, periodId: string): Promise<void> {
    const reportCard = await this.repositories.results.findByStudentAndPeriod(studentId, periodId)
    if (reportCard?.status === ReportCardResultStatus.Published) {
      throw new BusinessRuleViolationError('PUBLISHED_REPORT_CARD_IMMUTABLE', `Published report card for student ${studentId} and period ${periodId} is immutable`)
    }
  }

  private async authorize(
    action: 'assessments.manage_configuration' | 'assessments.record_result' | 'assessments.read_results' | 'assessments.publish_report_card',
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
