import type { Assessment } from '../../../entities/assessments/assessment'
import type { AssessmentResult } from '../../../entities/assessments/assessment-result'
import type { ReportCardDefinitionSection } from '../../../entities/assessments/report-card-definition-section'
import type { StudentClassEnrollment } from '../../../entities/students/student-class-enrollment'
import type { BaseSchoolService } from '../base-school-service'
import { ReportCardDefinitionSectionKind } from '../../../entities/assessments/report-card-definition-section'
import { ReportCardResult, ReportCardResultStatus } from '../../../entities/assessments/report-card-result'
import { ReportCardResultSection } from '../../../entities/assessments/report-card-result-section'
import { AttendanceJustificationStatus, AttendanceStatus } from '../../../entities/scheduling/attendance-record'
import { normalizeDate, roundTo2 } from '../../../entities/utils'
import { AttendanceSummary } from '../../../value_object/attendance-summary'
import { denyResourceAccess } from '../../authorization/authorization-error'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { BaseServiceWorkflow } from './base-service-workflow'

export interface PublishReportCardResultInput {
  id: string
  studentId: string
  periodId: string
  reportCardDefinitionId?: string
  publishedAt?: Date
}

export interface GenerateReportCardResultInput {
  id: string
  studentId: string
  periodId: string
  reportCardDefinitionId?: string
  generatedAt?: Date
}

export class AssessmentsServiceWorkflow extends BaseServiceWorkflow {
  constructor(base: BaseSchoolService) {
    super(base)
  }

  async generateReportCardResult(input: GenerateReportCardResultInput): Promise<ReportCardResult> {
    const student = await this.requireStudent(input.studentId)
    this.checkActorSchool(student.schoolId)
    await this.base.authorizationPolicy.checkGlobalAction(this.base.actor, 'assessments.publish_report_card')
    await this.base.authorizationPolicy.checkStudentAccess(this.base.actor, [student.id])
    await this.requireReportCardResources(input.periodId, input.reportCardDefinitionId, student.schoolId)
    await this.requireReportCardNotPublished(input.studentId, input.periodId)
    const reportCard = await this.buildReportCardResult(input)
    await this.base.results.save(reportCard, { moduleChecked: true })
    return reportCard
  }

  async publishReportCardResult(input: PublishReportCardResultInput): Promise<ReportCardResult> {
    const student = await this.requireStudent(input.studentId)
    this.checkActorSchool(student.schoolId)
    await this.base.authorizationPolicy.checkGlobalAction(this.base.actor, 'assessments.publish_report_card')
    await this.base.authorizationPolicy.checkStudentAccess(this.base.actor, [student.id])
    await this.base.authorizationPolicy.checkReportCardResultAccess(this.base.actor, [input.id])
    await this.requireReportCardResources(input.periodId, input.reportCardDefinitionId, student.schoolId)
    return this.base.atomicExecution.execute(async () => {
      await this.requireReportCardNotPublished(input.studentId, input.periodId)
      const generated = await this.buildReportCardResult(input)
      const published = generated.copyWith({
        status: ReportCardResultStatus.Published,
        publishedAt: input.publishedAt ?? new Date(),
      })
      await this.base.results.save(published, { moduleChecked: true })
      return published
    })
  }

  private async requireReportCardResources(
    periodId: string,
    reportCardDefinitionId: string | undefined,
    schoolId: string,
  ): Promise<void> {
    const period = await this.base.repositories.academicPeriods.findById(periodId)
    const definition = reportCardDefinitionId
      ? await this.base.repositories.definitions.findById(reportCardDefinitionId)
      : undefined
    if (!period || period.schoolId !== schoolId || (reportCardDefinitionId && !definition)) {
      denyResourceAccess()
    }
    if (definition && definition.schoolId !== schoolId) {
      denyResourceAccess()
    }
  }

  private async requireReportCardNotPublished(studentId: string, periodId: string): Promise<void> {
    const reportCard = await this.base.repositories.results.findOne({ studentId, periodId })
    if (reportCard?.status === ReportCardResultStatus.Published) {
      throw new BusinessRuleViolationError('PUBLISHED_REPORT_CARD_IMMUTABLE', `Published report card for student ${studentId} and period ${periodId} is immutable`)
    }
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
    const existing = await this.base.repositories.results.findOne({ studentId, periodId })
    return new ReportCardResult({
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
  }): Promise<{ sectionResults: ReportCardResultSection[], overallAverage?: number }> {
    await this.requirePeriod(periodId)
    const periodAssessmentResults = await this.listResultsForStudentAndPeriod(studentId, periodId)
    const assessmentResultsByClassSubject = new Map<string, Array<{ result: AssessmentResult, assessment: Assessment }>>()
    for (const { result, assessment } of periodAssessmentResults) {
      assessmentResultsByClassSubject.set(assessment.classSubjectId, [
        ...(assessmentResultsByClassSubject.get(assessment.classSubjectId) ?? []),
        { result, assessment },
      ])
    }
    const classSubjects = await this.base.repositories.classSubjects.list({ classGroupId })
    const classSubjectBySubject = new Map(classSubjects.map(classSubject => [classSubject.subjectId, classSubject]))
    const allSections = (await this.base.repositories.sections.list({ reportCardDefinitionId }))
      .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))

    const computeNode = async (
      section: ReportCardDefinitionSection,
      visited = new Set<string>(),
    ): Promise<ReportCardResultSection | null> => {
      if (visited.has(section.id)) {
        throw new BusinessRuleViolationError('REPORT_CARD_SECTION_CYCLE', 'report card definition sections must not contain cycles')
      }
      const nextVisited = new Set(visited).add(section.id)
      const childSections = allSections.filter(item => item.parentSectionId === section.id)
      if (section.kind === ReportCardDefinitionSectionKind.Subject) {
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
        return new ReportCardResultSection({
          sectionId: section.id,
          sectionKind: ReportCardDefinitionSectionKind.Subject,
          name: section.name,
          average: totalWeight === 0 ? 0 : weightedPoints / totalWeight,
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
        const childResult = await computeNode(child, nextVisited)
        if (childResult) {
          childResults.push(childResult)
          sumWeights += child.weight
          sumWeightedPoints += childResult.average * child.weight
        }
      }
      if (childResults.length === 0)
        return null
      return new ReportCardResultSection({
        sectionId: section.id,
        sectionKind: ReportCardDefinitionSectionKind.Group,
        name: section.name,
        average: sumWeights === 0 ? 0 : sumWeightedPoints / sumWeights,
        weight: section.weight,
        parentSectionId: section.parentSectionId,
        subResults: childResults,
      })
    }

    const sectionResults: ReportCardResultSection[] = []
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

  private async requireEnrollmentForPeriod({
    studentId,
    academicYearId,
  }: {
    studentId: string
    academicYearId: string
  }): Promise<StudentClassEnrollment> {
    const enrollments = await this.base.repositories.enrollments.list({ studentId })
    for (const enrollment of enrollments) {
      const classGroup = await this.base.repositories.classGroups.findById(enrollment.classGroupId)
      if (classGroup?.academicYearId === academicYearId) {
        return enrollment
      }
    }
    throw new BusinessRuleViolationError('STUDENT_NOT_ENROLLED_IN_YEAR', `Student ${studentId} is not enrolled in academic year ${academicYearId}`)
  }

  private async requireReportCardDefinition(reportCardDefinitionId: string) {
    const definition = await this.base.repositories.definitions.findById(reportCardDefinitionId)
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
    const definition = await this.base.repositories.definitions.findOne({ gradeLevelId, academicYearId, isDefault: true })
    if (!definition) {
      throw new BusinessRuleViolationError('NO_DEFAULT_REPORT_CARD_DEFINITION', `No default report card definition for grade level ${gradeLevelId}`)
    }
    return definition
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
    const records = await this.base.repositories.attendance.list({
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
    const results = await this.base.repositories.assessmentResults.list({ studentId })
    const resolved: Array<{ result: AssessmentResult, assessment: Assessment }> = []
    for (const result of results) {
      const assessment = await this.base.repositories.assessments.findById(result.assessmentId)
      if (assessment?.periodId === periodId) {
        resolved.push({ result, assessment })
      }
    }
    return resolved
  }
}
