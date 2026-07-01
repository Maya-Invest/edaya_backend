import type { ActivitySession, Assessment, LessonSession, OccurrenceStatus } from '../../domain'
import type { SchoolRepositories } from '../../ports/repositories/school-repositories'
import { AssessmentKind } from '../../domain'
import { normalizeDate } from '../../domain/shared/utils'

export type TimetableEventKind = 'lesson' | 'activity' | 'assessment'

export interface TimetableEvent {
  kind: TimetableEventKind
  id: string
  classGroupId: string
  classSubjectId?: string
  activityId?: string
  title: string
  startsAt: Date
  endsAt: Date
  lessonSessionId?: string
  activitySessionId?: string
  assessmentId?: string
  status?: OccurrenceStatus
}

export interface GetClassGroupTimetableInput {
  classGroupId: string
  startDate: Date
  endDate: Date
}

export interface ClassGroupTimetable {
  classGroupId: string
  startDate: string
  endDate: string
  events: TimetableEvent[]
}

export async function buildClassGroupTimetable(
  repositories: SchoolRepositories,
  input: GetClassGroupTimetableInput,
): Promise<ClassGroupTimetable> {
  const rangeStart = normalizeDate(input.startDate)
  const rangeEnd = endOfUtcDay(normalizeDate(input.endDate))

  const [lessonSessions, activitySessions, assessments] = await Promise.all([
    repositories.lessonSessions.list({
      classGroupId: input.classGroupId,
      startsAt: { $gte: rangeStart, $lte: rangeEnd },
      $orderBy: [{ field: 'startsAt', direction: 'asc' }],
    }),
    repositories.activitySessions.list({
      classGroupId: input.classGroupId,
      startsAt: { $gte: rangeStart, $lte: rangeEnd },
      $orderBy: [{ field: 'startsAt', direction: 'asc' }],
    }),
    repositories.assessments.list({ classGroupId: input.classGroupId }),
  ])

  const lessonSessionById = new Map(lessonSessions.map(session => [session.id, session]))
  const events: TimetableEvent[] = [
    ...lessonSessions.map(lessonEventFromSession),
    ...activitySessions.map(activityEventFromSession),
    ...assessments
      .filter(assessment => isInClassTimetableAssessment(assessment))
      .flatMap(assessment => timetableEventsFromAssessment(assessment, lessonSessionById, rangeStart, rangeEnd)),
  ]

  events.sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime())

  return {
    classGroupId: input.classGroupId,
    startDate: toDateKey(rangeStart),
    endDate: toDateKey(normalizeDate(input.endDate)),
    events,
  }
}

function lessonEventFromSession(session: LessonSession): TimetableEvent {
  return {
    kind: 'lesson',
    id: session.id,
    classGroupId: session.classGroupId,
    classSubjectId: session.classSubjectId,
    title: session.displayLabel,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    lessonSessionId: session.id,
    status: session.status,
  }
}

function activityEventFromSession(session: ActivitySession): TimetableEvent {
  return {
    kind: 'activity',
    id: session.id,
    classGroupId: session.classGroupId,
    activityId: session.activityId,
    title: session.displayLabel,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    activitySessionId: session.id,
    status: session.status,
  }
}

function isInClassTimetableAssessment(assessment: Assessment): boolean {
  if (assessment.kind === AssessmentKind.Homework || assessment.dueAt) {
    return false
  }
  return Boolean(
    (assessment.startsAt && assessment.endsAt)
    || assessment.lessonSessionId,
  )
}

function timetableEventsFromAssessment(
  assessment: Assessment,
  lessonSessionById: Map<string, LessonSession>,
  rangeStart: Date,
  rangeEnd: Date,
): TimetableEvent[] {
  if (assessment.startsAt && assessment.endsAt) {
    if (!occurrenceOverlapsRange(assessment.startsAt, assessment.endsAt, rangeStart, rangeEnd)) {
      return []
    }
    return [assessmentEvent(assessment, assessment.startsAt, assessment.endsAt)]
  }

  if (assessment.lessonSessionId) {
    const lessonSession = lessonSessionById.get(assessment.lessonSessionId)
      ?? undefined
    if (!lessonSession || !occurrenceOverlapsRange(lessonSession.startsAt, lessonSession.endsAt, rangeStart, rangeEnd)) {
      return []
    }
    return [assessmentEvent(assessment, lessonSession.startsAt, lessonSession.endsAt, assessment.lessonSessionId)]
  }

  return []
}

function assessmentEvent(
  assessment: Assessment,
  startsAt: Date,
  endsAt: Date,
  lessonSessionId?: string,
): TimetableEvent {
  return {
    kind: 'assessment',
    id: assessment.id,
    classGroupId: assessment.classGroupId,
    classSubjectId: assessment.classSubjectId,
    title: assessment.title,
    startsAt,
    endsAt,
    lessonSessionId,
    assessmentId: assessment.id,
  }
}

function occurrenceOverlapsRange(startsAt: Date, endsAt: Date, rangeStart: Date, rangeEnd: Date): boolean {
  return startsAt < rangeEnd && endsAt > rangeStart
}

function endOfUtcDay(date: Date): Date {
  const end = new Date(date)
  end.setUTCHours(23, 59, 59, 999)
  return end
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}
