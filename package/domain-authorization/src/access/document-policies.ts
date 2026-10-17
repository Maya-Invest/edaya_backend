import type { DocumentIssuance, DocumentTemplateKey } from '@edaya/core'
import type { AccessPolicies } from './access-policies'
import { assertAnnualReportCardSources, BusinessRuleViolationError, DocumentAudience, DocumentIssuanceStatus, DocumentSourceType, EnrollmentEndReason, OccurrenceStatus, Permission, publishedReportSource, reportCardAcademicVersion, ReportCardResultStatus, StudentClassEnrollmentStatus } from '@edaya/core'
import { AccessFacts, denied } from './facts'

export interface DocumentIssueTarget {
  templateKey: DocumentTemplateKey
  sourceId: string
  studentId?: string
  classGroupId?: string
  teacherId?: string
  academicYearId: string
}

const FAMILY_TEMPLATES = new Set<DocumentTemplateKey>([
  'report-card.v1',
  'annual-report-card.v1',
  'schooling-certificate.v1',
  'enrollment-record.v1',
  'student-id-card.v1',
  'invoice.v1',
  'receipt.v1',
  'settlement-quittance.v1',
  'account-statement.v1',
  'payment-reminder.v1',
  'withdrawal-certificate.v1',
  'annual-transcript.v1',
  'convocation.v1',
])

const TEACHER_TEMPLATES = new Set<DocumentTemplateKey>([
  'logbook.v1',
  'class-timetable.v1',
  'teacher-timetable.v1',
  'class-roster.v1',
  'attendance-sheet.v1',
])

export class DocumentAccessPolicy {
  constructor(private readonly access: AccessPolicies) {}

  catalogAudience(templateKey: DocumentTemplateKey): readonly DocumentAudience[] {
    const audiences: DocumentAudience[] = [DocumentAudience.Staff]
    if (FAMILY_TEMPLATES.has(templateKey))
      audiences.push(DocumentAudience.Family)
    if (TEACHER_TEMPLATES.has(templateKey))
      audiences.push(DocumentAudience.Teacher)
    return audiences
  }

  async assertIssue(target: DocumentIssueTarget): Promise<void> {
    const actor = this.access.actor
    if (actor.kind === 'guardian' || actor.kind === 'student')
      return denied('Document generation requires staff or assigned-teacher authority')
    if (actor.kind === 'teacher' && !TEACHER_TEMPLATES.has(target.templateKey))
      return denied('Teachers may only issue assigned-class operational documents')
    await this.assertIssuePermission(target)
    await this.assertSourceLifecycle(target)
  }

  async assertVoid(issuance: DocumentIssuance): Promise<void> {
    if (['teacher', 'guardian', 'student'].includes(this.access.actor.kind))
      return denied('Document void requires staff authority')
    await this.access.assertResources(Permission.DOCUMENT_VOID, 'documentIssuances', [issuance.id])
  }

  async assertConfigureIssuanceAssets(): Promise<void> {
    if (this.access.actor.kind === 'system')
      return
    if (['teacher', 'guardian', 'student'].includes(this.access.actor.kind))
      return denied('Issuance assets require staff authority')
    await this.access.assertSchool(Permission.SCHOOL_LIFECYCLE_MANAGE)
  }

  async assertDownload(issuance: DocumentIssuance): Promise<void> {
    const actor = this.access.actor
    if (issuance.schoolId !== actor.schoolId)
      return denied('Document belongs to another school')
    if (issuance.status === DocumentIssuanceStatus.Preview && actor.kind !== 'staff' && actor.kind !== 'system')
      return denied('Preview documents are staff-only')
    if (issuance.templateKey === 'annual-report-card.v1')
      await this.assertAnnualSource(issuance.sourceId, issuance)
    if (actor.kind === 'guardian' || actor.kind === 'student') {
      if (!FAMILY_TEMPLATES.has(issuance.templateKey) || !issuance.isFamilyCurrent || !issuance.studentId)
        return denied('This document is not available for family download')
      await this.access.assertResources(Permission.STUDENT_READ, 'students', [issuance.studentId], 'read')
      await this.assertFamilySourceStillPermitted(issuance)
      return
    }
    if (actor.kind === 'system') {
      await this.assertIssue({
        templateKey: issuance.templateKey,
        sourceId: issuance.sourceId,
        studentId: issuance.studentId,
        classGroupId: issuance.classGroupId,
        academicYearId: issuance.academicYearId,
      })
      return
    }
    if (actor.kind === 'teacher') {
      if (!TEACHER_TEMPLATES.has(issuance.templateKey) || issuance.status !== DocumentIssuanceStatus.Ready)
        return denied('Teachers may only download assigned-class operational documents')
      await this.assertIssue({
        templateKey: issuance.templateKey,
        sourceId: issuance.sourceId,
        studentId: issuance.studentId,
        classGroupId: issuance.classGroupId,
        academicYearId: issuance.academicYearId,
      })
      return
    }
    if (issuance.status !== DocumentIssuanceStatus.Ready && issuance.status !== DocumentIssuanceStatus.Preview)
      return denied('Document is not downloadable')
    await this.assertIssue({
      templateKey: issuance.templateKey,
      sourceId: issuance.sourceId,
      studentId: issuance.studentId,
      classGroupId: issuance.classGroupId,
      academicYearId: issuance.academicYearId,
    })
  }

  readScope() {
    return this.access.scope([
      Permission.STUDENT_READ,
      Permission.CLASS_READ,
      Permission.PAYMENT_READ,
      Permission.REPORT_CARD_READ,
      Permission.REPORT_CARD_EXPORT,
      Permission.CLASS_LOGBOOK_READ,
      Permission.DISCIPLINE_READ,
      Permission.ATTENDANCE_READ,
      Permission.TIMETABLE_READ,
      Permission.ENROLLMENT_READ,
      Permission.DOCUMENT_VOID,
    ], 'documentIssuances')
  }

  private async assertIssuePermission(target: DocumentIssueTarget): Promise<void> {
    switch (target.templateKey) {
      case 'report-card.v1':
      case 'annual-report-card.v1':
      case 'annual-transcript.v1':
        if (!target.studentId)
          return denied('Student is required')
        await this.access.assertResources(
          target.templateKey !== 'annual-transcript.v1' ? Permission.REPORT_CARD_EXPORT : [Permission.REPORT_CARD_READ],
          'students',
          [target.studentId],
        )
        return
      case 'logbook.v1':
        if (!target.classGroupId)
          return denied('Class is required')
        await this.access.assertResources(Permission.CLASS_LOGBOOK_READ, 'classGroups', [target.classGroupId], 'read')
        return
      case 'schooling-certificate.v1':
      case 'enrollment-record.v1':
      case 'student-id-card.v1':
      case 'withdrawal-certificate.v1':
      case 'convocation.v1':
        if (!target.studentId)
          return denied('Student is required')
        await this.access.assertResources(
          [Permission.ENROLLMENT_READ, Permission.STUDENT_MANAGE, Permission.STUDENT_READ],
          'students',
          [target.studentId],
          'read',
        )
        return
      case 'invoice.v1':
      case 'receipt.v1':
      case 'settlement-quittance.v1':
      case 'payment-reminder.v1':
        if (!target.studentId)
          return denied('Student is required')
        await this.access.assertResources(Permission.PAYMENT_READ, 'students', [target.studentId], 'read')
        return
      case 'account-statement.v1':
        if (!target.studentId)
          return denied('Student is required')
        await this.access.assertResources(Permission.FINANCIAL_REPORT_READ, 'students', [target.studentId], 'read')
        return
      case 'class-timetable.v1':
      case 'class-roster.v1':
        if (!target.classGroupId)
          return denied('Class is required')
        await this.access.assertResources(
          target.templateKey === 'class-timetable.v1' ? Permission.TIMETABLE_READ : Permission.CLASS_READ,
          'classGroups',
          [target.classGroupId],
          'read',
        )
        return
      case 'teacher-timetable.v1': {
        const facts = new AccessFacts(this.access.actor, this.access.repositories)
        const teacherId = target.teacherId ?? target.sourceId
        await facts.one('teachers', teacherId)
        if (this.access.actor.kind === 'teacher' && this.access.actor.teacherId !== teacherId)
          denied()
        await facts.one('academicYears', target.academicYearId)
        const classes = await facts.list('classGroups', { academicYearId: target.academicYearId })
        const sessions = classes.length ? (await facts.list('lessonSessions', { classGroupId: { $in: classes.map(group => group.id) }, timetableGenerated: true, status: { $ne: OccurrenceStatus.Cancelled } })).filter(session => session.timetableTeacherIds.includes(teacherId)) : []
        if (!sessions.length)
          denied('Teacher timetable has no authorized sessions')
        await this.access.assertResources(Permission.TIMETABLE_READ, 'lessonSessions', sessions.map(session => session.id), 'read')
        return
      }
      case 'attendance-sheet.v1':
        if (!target.classGroupId)
          return denied('Class is required')
        await this.access.assertResources(Permission.ATTENDANCE_READ, 'classGroups', [target.classGroupId], 'read')
        return
      case 'incident-report.v1':
        await this.access.assertResources(Permission.DISCIPLINE_READ, 'incidents', [target.sourceId], 'read')
        return
      default:
        return denied('Unsupported document template')
    }
  }

  private async assertSourceLifecycle(target: DocumentIssueTarget): Promise<void> {
    const facts = new AccessFacts(this.access.actor, this.access.repositories)
    if (target.templateKey === 'annual-report-card.v1')
      await this.assertAnnualSource(target.sourceId)
    if (target.templateKey === 'report-card.v1') {
      const result = await facts.one('results', target.sourceId)
      const period = await facts.one('academicPeriods', result.periodId)
      if (result.status !== ReportCardResultStatus.Published || !period.isPublished)
        throw new BusinessRuleViolationError('DOCUMENT_SOURCE_UNPUBLISHED', 'Report documents require a published result and academic period')
    }
    if (target.templateKey === 'withdrawal-certificate.v1') {
      const enrollment = await facts.one('enrollments', target.sourceId)
      if (enrollment.status !== StudentClassEnrollmentStatus.Closed || enrollment.endReason !== EnrollmentEndReason.Withdrawn)
        throw new BusinessRuleViolationError('DOCUMENT_SOURCE_MISSING', 'Radiation requires a completed withdrawal')
    }
  }

  private async assertAnnualSource(resultId: string, issuance?: DocumentIssuance): Promise<void> {
    const facts = new AccessFacts(this.access.actor, this.access.repositories)
    const annual = await facts.one('results', resultId)
    const annualPeriod = await facts.one('academicPeriods', annual.periodId)
    const contributors = []
    for (const periodId of annual.aggregation?.sourcePeriodIds ?? []) {
      const reports = await facts.list('results', { studentId: annual.studentId, periodId, status: ReportCardResultStatus.Published })
      if (reports.length !== 1)
        throw new BusinessRuleViolationError('DOCUMENT_SOURCE_UNPUBLISHED', 'Each annual source period must have one published report')
      const result = await publishedReportSource(reports[0]!, annual.aggregation?.sourceReportVersions?.find(source => source.periodId === periodId)?.sourceVersion)
      const period = await facts.one('academicPeriods', periodId)
      const sourceDefinition = await facts.one('definitions', result.reportCardDefinitionId)
      const classGroup = await facts.one('classGroups', result.classGroupId)
      if (result.grading?.scaleId !== annual.grading?.scaleId || result.grading?.maximum !== annual.grading?.maximum || sourceDefinition.academicYearId !== annualPeriod.academicYearId || classGroup.academicYearId !== annualPeriod.academicYearId)
        return denied('Annual report sources have incompatible academic placement')
      contributors.push({ result, period })
    }
    await assertAnnualReportCardSources(annual, annualPeriod, contributors)
    if (issuance) {
      if (issuance.studentId !== annual.studentId || issuance.academicYearId !== annualPeriod.academicYearId)
        return denied('Annual document source does not match its student and year')
      const sources = [annual, ...contributors.map(entry => entry.result)]
      const versions = await Promise.all(sources.map(async result => ({ result, version: await reportCardAcademicVersion(result) })))
      if (issuance.snapshot.academicSources?.length !== sources.length || versions.some(({ result, version }) => !issuance.snapshot.academicSources?.some(source => source.resultId === result.id && source.periodId === result.periodId && source.sourceVersion === version)))
        throw new BusinessRuleViolationError('DOCUMENT_SOURCE_CHANGED', 'Annual document sources changed; issue a replacement')
    }
  }

  private async assertFamilySourceStillPermitted(issuance: DocumentIssuance): Promise<void> {
    const facts = new AccessFacts(this.access.actor, this.access.repositories)
    if (issuance.sourceType === DocumentSourceType.ReportCardResult) {
      const result = await facts.one('results', issuance.sourceId)
      const period = await facts.one('academicPeriods', result.periodId)
      if (result.status !== ReportCardResultStatus.Published || !period.isPublished)
        return denied('Published academic source is no longer available')
    }
    if (issuance.templateKey === 'withdrawal-certificate.v1') {
      const enrollment = await facts.one('enrollments', issuance.sourceId)
      if (enrollment.status !== StudentClassEnrollmentStatus.Closed || enrollment.endReason !== EnrollmentEndReason.Withdrawn)
        return denied('Withdrawal source is no longer available')
    }
    if (issuance.templateKey === 'schooling-certificate.v1') {
      const enrollment = await facts.one('enrollments', issuance.sourceId)
      if (enrollment.status !== StudentClassEnrollmentStatus.Active)
        return denied('Schooling certificate requires a current enrollment')
    }
  }
}
