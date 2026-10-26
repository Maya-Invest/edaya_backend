import type { Attachment, DocumentTeacher, GradeLevel, ReportCardResultSection } from '@edaya/core'
import type { AccessPolicies } from './access-policies'
import { assertAnnualReportCardSources, AttachmentOwnerKind, BusinessRuleViolationError, Permission, publishedReportSource, ReportCardResultStatus, TeacherAssignmentKind } from '@edaya/core'
import { AccessFacts, denied } from './facts'

/** Publication authorizes the document and its supporting data as one business action. */
export class ReportCardAccessPolicy {
  constructor(private readonly access: AccessPolicies) {}

  assertConfigureGrading(level: GradeLevel, existing: GradeLevel) {
    return this.access.assertSave(Permission.REPORT_CARD_CONFIGURE, 'gradeLevels', level, existing)
  }

  async configurationScopes(gradeLevelId: string) {
    const actions = [Permission.ACADEMIC_CATALOG_READ, Permission.ACADEMIC_CATALOG_MANAGE, Permission.REPORT_CARD_CONFIGURE, Permission.ACADEMIC_PROGRAM_READ, Permission.ACADEMIC_PROGRAM_MANAGE, Permission.REPORT_CARD_GENERATE]
    await this.access.assertResources(actions, 'gradeLevels', [gradeLevelId])
    return {
      subjects: await this.access.scope(actions, 'subjects'),
      modules: await this.access.scope(actions, 'reportModules'),
    }
  }

  assertGenerate(studentId: string) {
    return this.access.assertResources(Permission.REPORT_CARD_GENERATE, 'students', [studentId])
  }

  assertPublish(studentId: string) {
    return this.access.assertResources(Permission.REPORT_CARD_PUBLISH, 'students', [studentId])
  }

  async assertHomeroomComment(input: { studentId: string, resultId: string }) {
    await this.access.assertResources(Permission.REPORT_CARD_COMMENT, 'students', [input.studentId])
    await this.access.assertResources(Permission.REPORT_CARD_COMMENT, 'results', [input.resultId])
  }

  readScope() {
    return this.access.scope([Permission.REPORT_CARD_READ, Permission.GRADE_READ], 'results')
  }

  private async documentTarget(resultId: string, publication = false) {
    if (['teacher', 'guardian', 'student'].includes(this.access.actor.kind))
      return denied('Document generation requires publication authority')
    const scope = await this.access.assertResources(publication ? Permission.REPORT_CARD_PUBLISH : Permission.REPORT_CARD_EXPORT, 'results', [resultId])
    const facts = new AccessFacts(this.access.actor, this.access.repositories)
    const result = await facts.one('results', resultId)
    const student = await facts.one('students', result.studentId)
    const school = await facts.one('schools', this.access.actor.schoolId)
    const period = await facts.one('academicPeriods', result.periodId)
    const classGroup = await facts.one('classGroups', result.classGroupId)
    const academicYear = await facts.one('academicYears', period.academicYearId)
    if (classGroup.academicYearId !== academicYear.id || result.academicYearId !== academicYear.id || result.gradeLevelId !== classGroup.gradeLevelId)
      return denied('Report card placement is inconsistent')

    return { scope, facts, result, student, school, period, classGroup, academicYear }
  }

  async documentContext(resultId: string, publication = false) {
    const { scope, facts, result, student, school, period, classGroup, academicYear } = await this.documentTarget(resultId, publication)
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
    const teachersByClassSubjectId = new Map<string, DocumentTeacher[]>()
    const teacherNameByClassSubjectId = new Map<string, string>()
    for (const id of subjectIds) {
      const classSubject = await facts.one('classSubjects', id)
      if (classSubject.classGroupId !== classGroup.id)
        return denied('Report card subject belongs to another class')
      subjects.push({ classSubjectId: id, subject: await facts.one('subjects', classSubject.subjectId) })
      const teachers = await facts.assignedTeachers({ academicYearId: academicYear.id, classGroupId: classGroup.id, kind: TeacherAssignmentKind.Subject, classSubjectId: id })
      teachersByClassSubjectId.set(id, teachers)
      const names = [...new Set(teachers.map(teacher => teacher.name))].join(', ')
      if (names)
        teacherNameByClassSubjectId.set(id, names)
    }
    const homeroomTeachers = await facts.assignedTeachers({ academicYearId: academicYear.id, classGroupId: classGroup.id, kind: TeacherAssignmentKind.Homeroom })

    const homeroomTeacherName = [...new Set(homeroomTeachers.map(teacher => teacher.name))].join(', ') || undefined

    const peerResults = await this.access.repositories.results.forAccess(scope).list({ classGroupId: classGroup.id, periodId: period.id, reportConfigurationRevision: result.reportConfigurationRevision, gradingPolicyRevision: result.gradingPolicyRevision, status: ReportCardResultStatus.Published })
    const attachments = await this.access.repositories.attachments.forAccess(await this.access.scope(publication ? Permission.REPORT_CARD_PUBLISH : Permission.REPORT_CARD_EXPORT, 'attachments')).list({ ownerKind: AttachmentOwnerKind.ReportCard, ownerId: result.id })
    return { result, student, school, period, classGroup, academicYear, subjects, teacherNameByClassSubjectId, teachersByClassSubjectId, homeroomTeacherName, homeroomTeachers, peerResults, attachments }
  }

  async annualDocumentContext(resultId: string, publication = false) {
    const annual = await this.documentContext(resultId, publication)
    const ids = annual.result.aggregation?.sourcePeriodIds ?? []
    const facts = new AccessFacts(this.access.actor, this.access.repositories)
    const contributors: Array<Awaited<ReturnType<ReportCardAccessPolicy['documentContext']>>> = []
    for (const periodId of ids) {
      const reports = await facts.list('results', { studentId: annual.student.id, periodId, status: ReportCardResultStatus.Published })
      if (reports.length !== 1)
        throw new BusinessRuleViolationError('DOCUMENT_SOURCE_UNPUBLISHED', 'Each contributing period must have one published report')
      const context = await this.documentContext(reports[0]!.id, publication)
      context.result = await publishedReportSource(context.result, annual.result.aggregation?.sourceReportVersions?.find(source => source.periodId === periodId)?.sourceVersion)
      if (context.result.grading?.scaleId !== annual.result.grading?.scaleId || context.result.grading?.maximum !== annual.result.grading?.maximum)
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
    const scope = await this.access.assertSave(Permission.REPORT_CARD_EXPORT, 'attachments', attachment, existing)
    return { scope, result, period }
  }
}
