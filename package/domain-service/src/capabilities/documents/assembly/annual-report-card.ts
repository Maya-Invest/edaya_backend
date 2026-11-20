import type { School } from '@edaya/core'
/* eslint-disable dot-notation -- TypeScript requires bracket access for snapshot payload index signatures. */
import type { AssembledDocumentSource, AssembleDocumentInput, DocumentAssemblyContext } from './shared'
import { DocumentSourceType, reportCardAcademicVersion } from '@edaya/core'
import { digestCommandRequest } from '../../../services/commands/command-execution'
import { applyReportCommentRevision } from '../../academics/report-comment-revisions'
import { buildAnnualReportCardV1Payload } from '../build-annual-report-card-v1-payload'
import { catalogLangFromLocale, catalogSubjectName } from '../catalog-label'
import { formatDocumentDate, formatReportAverage, gradingPeerAverages } from '../document-format'
import { captureTeacherSignatures, freezeDocumentTeachers, freezeTeachersBySubject } from '../document-teachers'

export async function assembleAnnualReportCard(
  base: DocumentAssemblyContext<'teacherCorrections', 'reportCards'>,
  input: AssembleDocumentInput,
  school: School,
  locale: string,
  timeZone: string,
  title: string,
  branding: Record<string, unknown>,
): Promise<AssembledDocumentSource> {
  const { annual, contributors } = await base.access.reportCards.annualDocumentContext(input.sourceId, input.reportPublication)
  const revision = await base.repositories.teacherCorrections.state(base.actor.schoolId, 'report_comments', annual.result.id)
  const snapshot = revision?.payload['snapshot']
  const result = snapshot ? applyReportCommentRevision(annual.result, snapshot) : annual.result
  const subjectIdByClassSubjectId = new Map<string, string>()
  const subjectNameByClassSubjectId = new Map<string, string>()
  for (const context of [annual, ...contributors]) {
    for (const { classSubjectId, subject } of context.subjects) {
      subjectIdByClassSubjectId.set(classSubjectId, subject.id)
      subjectNameByClassSubjectId.set(classSubjectId, catalogSubjectName(subject.name, catalogLangFromLocale(locale), subject.shortName))
    }
  }
  const aggregation = annual.result.aggregation!
  const peers = annual.peerResults.filter(entry => !entry.calculationStale && !entry.pendingCorrectionIds.length && !entry.pendingAssessmentIds.length
    && entry.aggregation?.source === aggregation.source
    && entry.aggregation.sourcePeriodIds.length === aggregation.sourcePeriodIds.length
    && aggregation.sourcePeriodIds.every(id => entry.aggregation!.sourcePeriodIds.includes(id)
      && (entry.aggregation!.periodWeightsByPeriodId?.[id] ?? 1) === (aggregation.periodWeightsByPeriodId?.[id] ?? 1)))
  const averages = gradingPeerAverages(result, peers)
  const format = (value: number) => formatReportAverage(value, result.grading, locale)
  const payload = buildAnnualReportCardV1Payload({
    result,
    student: annual.student,
    school,
    periodLabel: annual.period.name,
    classLabel: annual.classGroup.name,
    schoolYear: annual.academicYear.name,
    locale,
    subjectIdByClassSubjectId,
    subjectNameByClassSubjectId,
    teacherNameByClassSubjectId: annual.teacherNameByClassSubjectId,
    teachersByClassSubjectId: input.legacyTeacherNamesOnly ? undefined : freezeTeachersBySubject(annual.teachersByClassSubjectId, input.teacherSignatures),
    homeroomTeachers: input.legacyTeacherNamesOnly ? undefined : freezeDocumentTeachers(annual.homeroomTeachers, input.teacherSignatures),
    homeroomTeacherName: annual.homeroomTeacherName,
    periods: contributors.map(context => ({ period: context.period, result: context.result })),
    classResults: averages.length
      ? {
          classAverage: format(averages.reduce((sum, value) => sum + value, 0) / averages.length),
          lowestAverage: format(Math.min(...averages)),
          highestAverage: format(Math.max(...averages)),
        }
      : undefined,
  })
  const academicSources = (await Promise.all([annual, ...contributors].map(async context => ({
    resultId: context.result.id,
    periodId: context.period.id,
    sourceVersion: await reportCardAcademicVersion(context.result),
  })))).sort((a, b) => a.resultId.localeCompare(b.resultId))
  const sourceVersion = await digestCommandRequest({
    academicSources,
    aggregation: annual.result.aggregation,
    commentRevision: revision?.version,
    payload,
  })
  return {
    academicYearId: annual.academicYear.id,
    sourceType: DocumentSourceType.ReportCardResult,
    sourceId: annual.result.id,
    sourceVersion,
    studentId: annual.student.id,
    classGroupId: annual.classGroup.id,
    portraitRequired: false,
    snapshot: {
      facts: {
        kind: input.templateKey,
        documentTitle: title,
        ...payload,
        date: formatDocumentDate(annual.result.publishedAt!, locale, timeZone),
        schoolName: school.issuingName ?? school.name,
        schoolCode: school.schoolCode,
        schoolAddress: school.postalAddress,
        schoolPhone: school.phone,
        schoolEmail: school.email,
      },
      teacherSignatures: captureTeacherSignatures(payload as unknown as Record<string, unknown>),
      academicSources,
      sourceVersion,
      locale: input.locale,
      timeZone,
      portraitAttachmentId: annual.student.photoAttachmentId,
      ...branding,
    },
  }
}
