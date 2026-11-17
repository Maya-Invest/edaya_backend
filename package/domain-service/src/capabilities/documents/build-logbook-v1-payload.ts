import type { OccurrenceStatus } from '@edaya/core'

export interface LogbookSessionSource {
  id: string
  classSubjectId: string
  startsAt: Date
  endsAt: Date
  displayLabel: string
  sessionNote?: string
  status: OccurrenceStatus | 'pending' | 'completed' | 'cancelled'
}

export interface LogbookProgressSource {
  lessonSessionId: string
  classSubjectMatterId: string
  completed?: boolean | null
  completedPercentage?: number
  notes?: string
}

export interface LogbookChapterSource {
  classSubjectMatterId: string
  name: string
}

export interface LogbookHomeworkSource {
  lessonSessionId: string
  /** Prefer description; fall back to title. */
  text: string
}

export interface LogbookSubjectSource {
  classSubjectId: string
  name: string
  teacherName?: string
}

export interface BuildLogbookV1PayloadInput {
  schoolName: string
  classLabel: string
  subjects: LogbookSubjectSource[]
  sessions: LogbookSessionSource[]
  progress: LogbookProgressSource[]
  chapters: LogbookChapterSource[]
  homework: LogbookHomeworkSource[]
  schoolCity?: string
  schoolYear?: string
  periodLabel?: string
  dateFrom?: string
  dateTo?: string
  primaryColor?: string
  documentTitle?: string
  locale?: string
  timeZone?: string
}

export interface LogbookV1Chapter {
  coverageLabel?: string
  name: string
  completedPercentage?: number
  notes?: string
}

export interface LogbookV1Entry {
  date: string
  timeLabel?: string
  title?: string
  content?: string
  homework?: string
  status?: 'pending' | 'completed' | 'cancelled'
  chapters?: LogbookV1Chapter[]
}

export interface LogbookV1Subject {
  name: string
  teacherName?: string
  entries: LogbookV1Entry[]
}

export interface LogbookV1Payload {
  schoolName: string
  classLabel: string
  subjects: LogbookV1Subject[]
  documentTitle?: string
  schoolYear?: string
  schoolCity?: string
  periodLabel?: string
  dateFrom?: string
  dateTo?: string
  primaryColor?: string
  summary?: {
    sessionCount: number
    subjectCount: number
  }
}

function formatDate(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value)
}

function formatTime(value: Date, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(value)
}

function normalizeStatus(
  status: LogbookSessionSource['status'],
): 'pending' | 'completed' | 'cancelled' | undefined {
  if (status === 'pending' || status === 'completed' || status === 'cancelled') {
    return status
  }
  return undefined
}

function guardianLogbookText(sessionNote: string | undefined): string | undefined {
  const value = sessionNote?.trim()
  if (!value)
    return undefined
  if (!value.startsWith('{"edayaLogbook":'))
    return value
  try {
    const decoded = JSON.parse(value) as { edayaLogbook?: { content?: string, objectives?: string[], homework?: string } }
    const envelope = decoded.edayaLogbook
    if (!envelope)
      return value
    return [envelope.content, ...(envelope.objectives ?? []), envelope.homework]
      .map(part => part?.trim())
      .filter((part): part is string => Boolean(part))
      .join('\n') || undefined
  }
  catch {
    return value
  }
}

function hasLogbookContent(input: {
  sessionNote?: string
  chapters: LogbookV1Chapter[]
  homework?: string
}): boolean {
  return Boolean(
    input.sessionNote?.trim()
    || input.homework?.trim()
    || input.chapters.length > 0,
  )
}

/**
 * Maps class lesson sessions (+ progress / homework) into a `logbook.v1` docs payload.
 * Skips sessions with no note, chapters, or homework — status is not used for inclusion.
 */
export function buildLogbookV1Payload(input: BuildLogbookV1PayloadInput): LogbookV1Payload {
  const locale = input.locale ?? 'fr-FR'
  const timeZone = input.timeZone ?? 'Africa/Abidjan'

  const chapterNameByMatterId = new Map(
    input.chapters.map(chapter => [chapter.classSubjectMatterId, chapter.name]),
  )
  const progressBySession = new Map<string, LogbookProgressSource[]>()
  for (const progress of input.progress) {
    const current = progressBySession.get(progress.lessonSessionId) ?? []
    current.push(progress)
    progressBySession.set(progress.lessonSessionId, current)
  }
  const homeworkBySession = new Map<string, string[]>()
  for (const homework of input.homework) {
    const text = homework.text.trim()
    if (!text) {
      continue
    }
    const current = homeworkBySession.get(homework.lessonSessionId) ?? []
    current.push(text)
    homeworkBySession.set(homework.lessonSessionId, current)
  }

  const subjects: LogbookV1Subject[] = []
  let sessionCount = 0

  for (const subject of input.subjects) {
    const subjectSessions = input.sessions
      .filter(session => session.classSubjectId === subject.classSubjectId)
      .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime())

    const entries: LogbookV1Entry[] = []
    for (const session of subjectSessions) {
      const progressRecords = progressBySession.get(session.id) ?? []
      const chapters: LogbookV1Chapter[] = progressRecords.flatMap((progress) => {
        const name = chapterNameByMatterId.get(progress.classSubjectMatterId)?.trim()
        if (!name) {
          return []
        }
        return [{
          name,
          ...(progress.completed === undefined
            ? { completedPercentage: progress.completedPercentage }
            : {
                coverageLabel: progress.completed === null
                  ? (locale.startsWith('fr') ? 'Référence historique' : 'Historical reference')
                  : progress.completed
                    ? (locale.startsWith('fr') ? 'Chapitre terminé pendant cette séance' : 'Completed in this session')
                    : (locale.startsWith('fr') ? 'Abordé' : 'Covered'),
              }),
          ...(progress.notes ? { notes: progress.notes } : {}),
        }]
      })
      const homeworkTexts = homeworkBySession.get(session.id) ?? []
      const homework = homeworkTexts.length > 0 ? homeworkTexts.join('\n') : undefined
      const content = guardianLogbookText(session.sessionNote) || undefined

      if (!hasLogbookContent({ sessionNote: content, chapters, homework })) {
        continue
      }

      const primaryChapter = chapters[0]
      const title = primaryChapter?.name ?? session.displayLabel
      const timeLabel = `${formatTime(session.startsAt, timeZone, locale)}–${formatTime(session.endsAt, timeZone, locale)}`
      const status = normalizeStatus(session.status)

      entries.push({
        date: formatDate(session.startsAt, timeZone),
        timeLabel,
        title,
        ...(content ? { content } : {}),
        ...(homework ? { homework } : {}),
        ...(status ? { status } : {}),
        ...(chapters.length > 0 ? { chapters } : {}),
      })
    }

    if (entries.length === 0) {
      continue
    }

    sessionCount += entries.length
    subjects.push({
      name: subject.name,
      ...(subject.teacherName ? { teacherName: subject.teacherName } : {}),
      entries,
    })
  }

  if (subjects.length === 0) {
    throw new Error(`Class ${input.classLabel} has no logbook content to render`)
  }

  return {
    schoolName: input.schoolName,
    classLabel: input.classLabel,
    subjects,
    ...(input.documentTitle ? { documentTitle: input.documentTitle } : {}),
    ...(input.schoolYear ? { schoolYear: input.schoolYear } : {}),
    ...(input.schoolCity ? { schoolCity: input.schoolCity } : {}),
    ...(input.periodLabel ? { periodLabel: input.periodLabel } : {}),
    ...(input.dateFrom ? { dateFrom: input.dateFrom } : {}),
    ...(input.dateTo ? { dateTo: input.dateTo } : {}),
    ...(input.primaryColor ? { primaryColor: input.primaryColor } : {}),
    summary: {
      subjectCount: subjects.length,
      sessionCount,
    },
  }
}
