import type { School } from '@edaya/core'
import type { AssembledDocumentSource, AssembleDocumentInput, DocumentAssemblyContext } from './shared'
import {
  DOCUMENT_FAILURES,
  DocumentSourceType,
  ReportCardResultStatus,
} from '@edaya/core'

import { formatDocumentDate } from '../document-format'
import { fail, requireYear } from './shared'

export async function assembleAnnualTranscript(
  base: DocumentAssemblyContext<'academicPeriods' | 'academicYears' | 'classGroups' | 'results' | 'students', never>,
  input: AssembleDocumentInput,
  school: School,
  locale: string,
  timeZone: string,
  title: string,
  branding: Record<string, unknown>,
): Promise<AssembledDocumentSource> {
  const result = await base.repositories.results.findById(input.sourceId)
  if (!result)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Report card result was not found')
  const period = await base.repositories.academicPeriods.findById(result.periodId)
  const student = await base.repositories.students.findById(result.studentId)
  const classGroup = await base.repositories.classGroups.findById(result.classGroupId)
  if (!period || !student || !classGroup || student.schoolId !== base.actor.schoolId)
    fail(DOCUMENT_FAILURES.SOURCE_INACCESSIBLE, 'Annual transcript source is not accessible')
  if (result.status !== ReportCardResultStatus.Published || !period.isPublished)
    fail(DOCUMENT_FAILURES.SOURCE_UNPUBLISHED, 'Annual transcripts require published annual results')
  const year = await requireYear(base, period.academicYearId)
  const periods = await base.repositories.academicPeriods.list({ academicYearId: year.id })
  const published = await base.repositories.results.list({ studentId: student.id, status: ReportCardResultStatus.Published })
  const yearResults = published.filter(entry => periods.some(item => item.id === entry.periodId))
  if (yearResults.length === 0)
    fail(DOCUMENT_FAILURES.SOURCE_UNPUBLISHED, 'Annual transcripts require published annual results')
  const rows = yearResults.map((entry) => {
    const resultPeriod = periods.find(item => item.id === entry.periodId)
    return {
      cells: [
        resultPeriod?.name ?? entry.periodId,
        entry.overallAverage !== undefined ? `${entry.overallAverage}` : '—',
      ],
    }
  })
  const sourceVersion = yearResults.map(entry => `${entry.id}:${entry.publishedAt?.toISOString() ?? ''}`).sort().join('|')
  return {
    academicYearId: year.id,
    sourceType: DocumentSourceType.ReportCardResult,
    sourceId: result.id,
    sourceVersion,
    studentId: student.id,
    classGroupId: classGroup.id,
    portraitRequired: false,
    snapshot: {
      facts: {
        kind: 'annual-transcript.v1',
        documentTitle: title,
        schoolName: school.issuingName ?? school.name,
        studentName: student.fullName,
        classLabel: classGroup.name,
        schoolYear: year.name,
        date: formatDocumentDate(new Date(), locale, timeZone),
        columns: locale.startsWith('en') ? ['Period', 'Average'] : ['Période', 'Moyenne'],
        rows,
      },
      sourceVersion,
      locale: input.locale,
      timeZone,
      ...branding,
    },
  }
}
