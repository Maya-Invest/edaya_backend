import type { Attachment, ReportCardResultSection } from '@edaya/core'
import type { AccessPolicies } from './access-policies'
import { assertAnnualReportCardSources, AttachmentOwnerKind, BusinessRuleViolationError, Permission, ReportCardResultStatus, TeacherAssignmentKind } from '@edaya/core'
import { AccessFacts, denied } from './facts'

/** Publication authorizes the document and its supporting data as one business action. */
export class ReportCardAccessPolicy {
  constructor(private readonly access: AccessPolicies) {}

  assertGenerate(studentId: string) {
    return this.access.assertResources(Permission.REPORT_CARD_GENERATE, 'students', [studentId])
  }

  assertPublish(studentId: string) {
    return this.access.assertResources(Permission.REPORT_CARD_PUBLISH, 'students', [studentId])
  }

  async assertHomeroomComment(input: { studentId: string, resultId: string }) {
    await this.access.assertResources(Permission.REPORT_CARD_PUBLISH, 'students', [input.studentId])
    await this.access.assertResources(Permission.REPORT_CARD_PUBLISH, 'results', [input.resultId])
  }

  readScope() {
    return this.access.scope([Permission.QUERY_REPORT_CARD_DETAIL_READ, Permission.GRADE_READ, Permission.REPORT_CARD_READ], 'results')
  }

  private async documentTarget(resultId: string) {
    if (['teacher', 'guardian', 'student'].includes(this.access.actor.kind))
      return denied('Document generation requires publication authority')
    const scope = await this.access.assertResources(Permission.REPORT_CARD_PUBLISH, 'results', [resultId])
    const facts = new AccessFacts(this.access.actor, this.access.repositories)
    const result = await facts.one('results', resultId)
    const student = await facts.one('students', result.studentId)
    const school = await facts.one('schools', this.access.actor.schoolId)
    const period = await facts.one('academicPeriods', result.periodId)
    const classGroup = await facts.one('classGroups', result.classGroupId)
    const academicYear = await facts.one('academicYears', period.academicYearId)
    const definition = await facts.one('definitions', result.reportCardDefinitionId)
    if (classGroup.academicYearId !== academicYear.id || definition.academicYearId !== academicYear.id || definition.gradeLevelId !== classGroup.gradeLevelId)
      return denied('Report card placement is inconsistent')

    return { scope, facts, result, student, school, period, classGroup, academicYear, definition }
  }

  async documentContext(resultId: string) {
    const { scope, facts, result, student, school, period, classGroup, academicYear, definition } = await this.documentTarget(resultId)
    const subjectIds = new Set<string>()
    function collect(sections: readonly ReportCardResultSection[]) {
      for (const section of sections) {
        if (section.classSubjectId)
          subjectIds.add(section.classSubjectId)
        collect(section.subResults)
      }
    }
    collect(result.sectionResults)
    const subjects = []
    const teacherNameByClassSubjectId = new Map<string, string>()
    for (const id of subjectIds) {
      const classSubject = await facts.one('classSubjects', id)
      if (classSubject.classGroupId !== classGroup.id)
        return denied('Report card subject belongs to another class')
      subjects.push({ classSubjectId: id, subject: await facts.one('subjects', classSubject.subjectId) })
      const names = await facts.assignedTeacherNames({ academicYearId: academicYear.id, classGroupId: classGroup.id, kind: TeacherAssignmentKind.Subject, classSubjectId: id })
      if (names)
        teacherNameByClassSubjectId.set(id, names)
    }
    const homeroomTeacherName = await facts.assignedTeacherNames({ academicYearId: academicYear.id, classGroupId: classGroup.id, kind: TeacherAssignmentKind.Homeroom })

    const peerResults = await this.access.repositories.results.forAccess(scope).list({ classGroupId: classGroup.id, periodId: period.id, reportCardDefinitionId: definition.id, status: ReportCardResultStatus.Published })
    const attachments = await this.access.repositories.attachments.forAccess(await this.access.scope(Permission.REPORT_CARD_PUBLISH, 'attachments')).list({ ownerKind: AttachmentOwnerKind.ReportCard, ownerId: result.id })
    return { result, student, school, period, classGroup, academicYear, subjects, teacherNameByClassSubjectId, homeroomTeacherName, peerResults, attachments }
  }

  async annualDocumentContext(resultId: string) {
    const annual = await this.documentContext(resultId)
    const ids = annual.result.aggregation?.sourcePeriodIds ?? []
    const facts = new AccessFacts(this.access.actor, this.access.repositories)
    const contributors: Array<Awaited<ReturnType<ReportCardAccessPolicy['documentContext']>>> = []
    const definition = await facts.one('definitions', annual.result.reportCardDefinitionId)
    for (const periodId of ids) {
      const reports = await facts.list('results', { studentId: annual.student.id, periodId, status: ReportCardResultStatus.Published })
      if (reports.length !== 1)
        throw new BusinessRuleViolationError('DOCUMENT_SOURCE_UNPUBLISHED', 'Each contributing period must have one published report')
      const context = await this.documentContext(reports[0]!.id)
      const sourceDefinition = await facts.one('definitions', context.result.reportCardDefinitionId)
      if (sourceDefinition.gradeScaleId !== definition.gradeScaleId)
        throw new BusinessRuleViolationError('DOCUMENT_INPUT_CONFLICT', 'Annual report sources must use the same grading scale')
      contributors.push(context)
    }
    await assertAnnualReportCardSources(annual.result, annual.period, contributors)
    return { annual, contributors }
  }

  async assertDocumentAttachment(resultId: string, attachment: Attachment) {
    const existing = await this.access.repositories.attachments.findById(attachment.id)
    for (const value of [existing, attachment]) {
      if (value && (value.ownerKind !== AttachmentOwnerKind.ReportCard || value.ownerId !== resultId || value.schoolId !== this.access.actor.schoolId))
        return denied('A report document must retain its report card owner')
    }
    const { result, period } = await this.documentTarget(resultId)
    const scope = await this.access.assertSave(Permission.REPORT_CARD_PUBLISH, 'attachments', attachment, existing)
    return { scope, result, period }
  }
}
