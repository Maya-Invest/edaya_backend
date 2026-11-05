import type { School } from '@edaya/core'
import type { AssembledDocumentSource, AssembleDocumentInput, DocumentAssemblyContext } from './shared'
import {
  DOCUMENT_FAILURES,
  DocumentSourceType,
  OccurrenceStatus,
} from '@edaya/core'
import { buildLogbookV1Payload as composeLogbook } from '../build-logbook-v1-payload'

import { catalogClassName, catalogLangFromLocale, catalogMatter, catalogPeriodLabel, catalogSubjectName } from '../catalog-label'
import { formatDocumentIsoDate } from '../document-format'
import { fail } from './shared'

export async function assembleLogbook(
  base: DocumentAssemblyContext<never, 'logbooks'>,
  input: AssembleDocumentInput,
  school: School,
  locale: string,
  timeZone: string,
  title: string,
  branding: Record<string, unknown>,
): Promise<AssembledDocumentSource> {
  const context = await base.access.logbooks.documentContext({
    classGroupId: input.sourceId,
    academicPeriodId: input.academicPeriodId,
    classSubjectId: input.classSubjectId,
  })
  const catalogLang = catalogLangFromLocale(locale)
  const subjectNameById = new Map(context.subjects.map(entry => [entry.id, catalogSubjectName(entry.name, catalogLang, entry.shortName)]))
  const chapterNameByMatterLinkId = new Map(
    context.classSubjectMatters.map((link) => {
      const matter = context.subjectMatters.find(entry => entry.id === link.subjectMatterId)
      return [link.id, catalogMatter(matter?.name ?? '', catalogLang)] as const
    }).filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
  )
  let payload
  try {
    payload = composeLogbook({
      schoolName: school.name,
      classLabel: catalogClassName(context.classGroup.name, catalogLang),
      schoolCity: school.city,
      schoolYear: context.academicYear?.name,
      periodLabel: context.period ? catalogPeriodLabel(context.period.name, catalogLang) : undefined,
      dateFrom: context.period ? formatDocumentIsoDate(context.period.startDate, timeZone) : undefined,
      dateTo: context.period ? formatDocumentIsoDate(context.period.endDate, timeZone) : undefined,
      locale,
      timeZone,
      documentTitle: title,
      subjects: context.classSubjects.map(classSubject => ({
        classSubjectId: classSubject.id,
        name: subjectNameById.get(classSubject.subjectId) ?? classSubject.id,
        teacherName: context.teacherNameByClassSubjectId.get(classSubject.id),
      })),
      sessions: context.lessonSessions.map(session => ({
        id: session.id,
        classSubjectId: session.classSubjectId,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        displayLabel: session.displayLabel,
        sessionNote: session.sessionNote,
        status: session.status ?? OccurrenceStatus.Pending,
      })),
      progress: context.progressRecords.map(progress => ({
        lessonSessionId: progress.lessonSessionId,
        classSubjectMatterId: progress.classSubjectMatterId,
        completedPercentage: progress.completedPercentage,
        notes: progress.notes,
      })),
      chapters: [...chapterNameByMatterLinkId.entries()].map(([classSubjectMatterId, name]) => ({ classSubjectMatterId, name })),
      homework: context.homeworkAssessments.flatMap((assessment) => {
        if (!assessment.lessonSessionId)
          return []
        const text = (assessment.description ?? assessment.title).trim()
        if (!text)
          return []
        return [{ lessonSessionId: assessment.lessonSessionId, text }]
      }),
    })
  }
  catch (error) {
    if (error instanceof Error && /no logbook content/i.test(error.message))
      fail(DOCUMENT_FAILURES.SOURCE_MISSING, `No logbook content for class ${context.classGroup.name}`)
    throw error
  }
  const sessionStamp = context.lessonSessions.map(session => session.id).sort().join(',')
  return {
    academicYearId: context.academicYear?.id ?? context.classGroup.academicYearId,
    sourceType: DocumentSourceType.ClassLogbook,
    sourceId: context.classGroup.id,
    sourceVersion: `${sessionStamp}:${context.period?.id ?? ''}`,
    classGroupId: context.classGroup.id,
    portraitRequired: false,
    snapshot: {
      facts: { kind: 'logbook.v1', ...payload },
      sourceVersion: `${sessionStamp}:${context.period?.id ?? ''}`,
      locale: input.locale,
      timeZone,
      ...(context.period ? { academicPeriodId: context.period.id } : {}),
      ...(input.classSubjectId ? { classSubjectId: input.classSubjectId } : {}),
      ...branding,
    },
  }
}
