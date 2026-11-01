import type { ActivitySession, Assessment, LessonSession, OccurrenceStatus } from '@edaya/core'
import type { SchoolRepositories } from '../../ports/school-repositories'
import { effectiveAt } from '@edaya/authorization'
import { AssessmentKind, normalizeDate, TeacherAssignmentKind, TeacherAssignmentStatus } from '@edaya/core'

export type TimetableEventKind = 'lesson' | 'activity' | 'assessment'

export interface TimetableEvent {
  kind: TimetableEventKind
  id: string
  classGroupId: string
  classSubjectId?: string
  activityId?: string
  title: string
  /** Canonical subject or activity label for portal clients. Defaults to title. */
  subjectLabel?: string
  /** Subject teacher for lessons/assessments, or activity coach for activities. */
  teacherName?: string
  /** Snapshot teacher ids from generated lesson sessions. */
  timetableTeacherIds?: string[]
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

export interface GetTeacherTimetableInput {
  teacherId: string
  startDate: Date
  endDate: Date
}

export interface TeacherTimetable {
  teacherId: string
  startDate: string
  endDate: string
  events: TimetableEvent[]
}

export async function buildClassGroupTimetable(
  repositories: Pick<SchoolRepositories, 'lessonSessions' | 'activitySessions' | 'assessments' | 'classGroups' | 'teacherAssignments' | 'teachers' | 'activities'>,
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

  await enrichTimetableEventPresentation(repositories, input.classGroupId, events)

  return {
    classGroupId: input.classGroupId,
    startDate: toDateKey(rangeStart),
    endDate: toDateKey(normalizeDate(input.endDate)),
    events,
  }
}

export async function buildTeacherTimetable(
  repositories: Pick<SchoolRepositories, 'lessonSessions' | 'activitySessions' | 'assessments' | 'classGroups' | 'teacherAssignments' | 'teachers' | 'activities'>,
  input: GetTeacherTimetableInput,
): Promise<TeacherTimetable> {
  const rangeStart = normalizeDate(input.startDate)
  const rangeEnd = endOfUtcDay(normalizeDate(input.endDate))
  const now = new Date()

  const [lessonSessions, assignments] = await Promise.all([
    repositories.lessonSessions.list({
      startsAt: { $gte: rangeStart, $lte: rangeEnd },
      $orderBy: [{ field: 'startsAt', direction: 'asc' }],
    }),
    repositories.teacherAssignments.list({ teacherId: input.teacherId }),
  ])

  const teacherLessons = lessonSessions.filter(session => session.timetableTeacherIds.includes(input.teacherId))
  const activeSubjectClassIds = new Set(
    assignments
      .filter(assignment =>
        assignment.status === TeacherAssignmentStatus.Active
        && assignment.kind === TeacherAssignmentKind.Subject
        && effectiveAt(assignment, now)
        && assignment.classSubjectId,
      )
      .map(assignment => assignment.classSubjectId!),
  )

  const assessments = activeSubjectClassIds.size > 0
    ? await repositories.assessments.list({ classSubjectId: { $in: [...activeSubjectClassIds] } })
    : []

  const lessonSessionById = new Map(lessonSessions.map(session => [session.id, session]))
  const events: TimetableEvent[] = [
    ...teacherLessons.map(lessonEventFromSession),
    ...assessments
      .filter(assessment => isInClassTimetableAssessment(assessment) && assessment.classSubjectId && activeSubjectClassIds.has(assessment.classSubjectId))
      .flatMap(assessment => timetableEventsFromAssessment(assessment, lessonSessionById, rangeStart, rangeEnd)),
  ]

  events.sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime())

  const eventsByClass = new Map<string, TimetableEvent[]>()
  for (const event of events) {
    const group = eventsByClass.get(event.classGroupId) ?? []
    group.push(event)
    eventsByClass.set(event.classGroupId, group)
  }
  await Promise.all(
    [...eventsByClass.entries()].map(([classGroupId, classEvents]) =>
      enrichTimetableEventPresentation(repositories, classGroupId, classEvents),
    ),
  )

  return {
    teacherId: input.teacherId,
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
    timetableTeacherIds: session.timetableTeacherIds.length > 0 ? session.timetableTeacherIds : undefined,
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

function uniqueStrings(values: Iterable<string | undefined>): string[] {
  return [...new Set(values)].filter((value): value is string => Boolean(value))
}

async function enrichTimetableEventPresentation(
  repositories: Pick<SchoolRepositories, 'lessonSessions' | 'activitySessions' | 'assessments' | 'classGroups' | 'teacherAssignments' | 'teachers' | 'activities'>,
  classGroupId: string,
  events: TimetableEvent[],
): Promise<void> {
  if (events.length === 0) {
    return
  }

  const classGroup = await repositories.classGroups?.findById(classGroupId)
  if (!classGroup) {
    for (const event of events) {
      event.subjectLabel = event.title
    }
    return
  }

  const classSubjectIds = uniqueStrings(events.map(event => event.classSubjectId))
  const activityIds = uniqueStrings(events.map(event => event.activityId))

  const [assignments, activities] = await Promise.all([
    classSubjectIds.length > 0 && repositories.teacherAssignments
      ? repositories.teacherAssignments.list({
          academicYearId: classGroup.academicYearId,
          classSubjectId: { $in: classSubjectIds },
        })
      : Promise.resolve([]),
    activityIds.length > 0 && repositories.activities
      ? repositories.activities.findByIds(activityIds)
      : Promise.resolve([]),
  ])

  const now = new Date()
  const activeSubjectAssignments = assignments.filter(
    assignment =>
      assignment.status === TeacherAssignmentStatus.Active
      && assignment.kind === TeacherAssignmentKind.Subject
      && effectiveAt(assignment, now)
      && assignment.classSubjectId,
  )
  const snapshotTeacherIds = uniqueStrings(events.flatMap(event => event.timetableTeacherIds ?? []))
  const assignmentTeacherIds = uniqueStrings(activeSubjectAssignments.map(assignment => assignment.teacherId))
  const teacherIds = uniqueStrings([...assignmentTeacherIds, ...snapshotTeacherIds])
  const teachers = teacherIds.length > 0 && repositories.teachers
    ? await repositories.teachers.findByIds(teacherIds)
    : []
  const teacherNameById = new Map(
    teachers.map(teacher => [teacher.id, teacher.fullName.trim()] as const),
  )
  const activeTeacherIds = new Set(teachers.filter(teacher => teacher.isActive).map(teacher => teacher.id))
  const teacherNamesByClassSubjectId = new Map<string, Set<string>>()
  for (const assignment of activeSubjectAssignments) {
    if (!activeTeacherIds.has(assignment.teacherId))
      continue
    const classSubjectId = assignment.classSubjectId!
    const teacherName = teacherNameById.get(assignment.teacherId)
    if (teacherName) {
      const names = teacherNamesByClassSubjectId.get(classSubjectId) ?? new Set<string>()
      names.add(teacherName)
      teacherNamesByClassSubjectId.set(classSubjectId, names)
    }
  }

  const activityById = new Map(activities.map(activity => [activity.id, activity]))

  for (const event of events) {
    if (event.kind === 'activity') {
      const activity = event.activityId ? activityById.get(event.activityId) : undefined
      event.subjectLabel = activity?.name ?? event.title
      event.teacherName = activity?.coach
      continue
    }

    event.subjectLabel = event.title
    if (event.timetableTeacherIds?.length) {
      const snapshotNames = event.timetableTeacherIds
        .map(teacherId => teacherNameById.get(teacherId))
        .filter((name): name is string => Boolean(name))
      if (snapshotNames.length > 0) {
        event.teacherName = snapshotNames.join(', ')
        continue
      }
    }
    if (event.classSubjectId) {
      event.teacherName = [...teacherNamesByClassSubjectId.get(event.classSubjectId) ?? []].sort().join(', ') || undefined
    }
  }
}
