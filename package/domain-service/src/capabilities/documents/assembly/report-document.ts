import type { School } from '@edaya/core'
/* eslint-disable dot-notation -- TypeScript requires bracket access for command-owned payload index signatures. */
import type { AssembledDocumentSource, AssembleDocumentInput, DocumentAssemblyContext } from './shared'
import {
  DOCUMENT_FAILURES,
  DocumentIssuanceStatus,
  DocumentSourceType,
  ReportCardResultStatus,
} from '@edaya/core'
import { hydrateReportRevision } from '../../academics/report-comment-revisions'
import { buildReportCardV1Payload } from '../build-report-card-v1-payload'

import { catalogLangFromLocale, catalogSubjectName } from '../catalog-label'
import { captureTeacherSignatures, freezeDocumentTeachers, freezeTeachersBySubject } from '../document-teachers'
import { fail } from './shared'

export async function assembleReportDocument(
  base: DocumentAssemblyContext<'teacherCorrections' | 'documentIssuances', 'reportCards'>,
  input: AssembleDocumentInput,
  school: School,
  locale: string,
  timeZone: string,
  title: string,
  branding: Record<string, unknown>,
): Promise<AssembledDocumentSource> {
  const context = await base.access.reportCards.documentContext(input.sourceId)
  if (context.result.status !== ReportCardResultStatus.Published || !context.period.isPublished)
    fail(DOCUMENT_FAILURES.SOURCE_UNPUBLISHED, 'Report documents require a published result and academic period')
  const revision = await base.repositories.teacherCorrections.state(base.actor.schoolId, 'report_comments', context.result.id)
  if (revision?.payload['snapshot'])
    context.result = hydrateReportRevision(revision.payload['snapshot'])
  const catalogLang = catalogLangFromLocale(locale)
  const subjectNameByClassSubjectId = new Map(context.subjects.map(({ classSubjectId, subject }) => [classSubjectId, catalogSubjectName(subject.name, catalogLang, subject.code)]))
  const peerAverages = [...context.peerResults].sort((a, b) => a.id.localeCompare(b.id)).map(entry => entry.overallAverage).filter((value): value is number => value !== undefined)
  const formatAverage = (value: number) => `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} / 20`
  const payload = buildReportCardV1Payload({
    result: context.result,
    student: context.student,
    school: context.school,
    periodLabel: context.period.name,
    classLabel: context.classGroup.name,
    schoolYear: context.academicYear.name,
    locale,
    subjectNameByClassSubjectId,
    teacherNameByClassSubjectId: context.teacherNameByClassSubjectId,
    teachersByClassSubjectId: freezeTeachersBySubject(context.teachersByClassSubjectId, input.teacherSignatures),
    homeroomTeachers: freezeDocumentTeachers(context.homeroomTeachers, input.teacherSignatures),
    homeroomTeacherName: context.homeroomTeacherName,
    classResults: peerAverages.length
      ? {
          classAverage: formatAverage(peerAverages.reduce((sum, value) => sum + value, 0) / peerAverages.length),
          lowestAverage: formatAverage(Math.min(...peerAverages)),
          highestAverage: formatAverage(Math.max(...peerAverages)),
        }
      : undefined,
  })
  const previous = (await base.repositories.documentIssuances.forSchool!(base.actor.schoolId).list({ sourceId: context.result.id, templateKey: 'report-card.v1', status: DocumentIssuanceStatus.Ready })).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
  const priorFacts = revision ? previous?.snapshot.facts : undefined
  const facts = priorFacts ? { ...priorFacts, subjects: (priorFacts['subjects'] as Array<Record<string, unknown>>).map((row, index) => ({ ...row, appreciation: payload.subjects[index]?.appreciation, teachers: payload.subjects[index]?.teachers })), council: { ...(priorFacts['council'] as Record<string, unknown>), appreciation: payload.council?.appreciation, homeroomTeachers: payload.council?.homeroomTeachers } } : { kind: input.templateKey, documentTitle: title, ...payload, schoolCode: school.schoolCode, schoolAddress: school.postalAddress, schoolPhone: school.phone, schoolEmail: school.email }
  const publishedAt = context.result.publishedAt?.toISOString() ?? ''
  return {
    academicYearId: context.academicYear.id,
    sourceType: DocumentSourceType.ReportCardResult,
    sourceId: context.result.id,
    sourceVersion: `${publishedAt}:${context.period.id}:${context.result.reportCardDefinitionId}${revision ? `:comments:${revision.version}` : ''}`,
    studentId: context.student.id,
    classGroupId: context.classGroup.id,
    portraitRequired: false,
    snapshot: {
      facts,
      teacherSignatures: captureTeacherSignatures(facts),
      sourceVersion: `${publishedAt}:${context.period.id}`,
      locale: input.locale,
      timeZone,
      portraitAttachmentId: context.student.photoAttachmentId,
      ...branding,
    },
  }
}
