import type { AccessPolicies } from '@edaya/authorization'
import type { Assessment } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import type { TimetableEvent, TimetableEventKind } from './timetable'
import { AuthorizationError, denyResourceAccess } from '@edaya/authorization'
import { guardianLogbookText } from '../../capabilities/academics/guardian-logbook-text'
import { loadInBatches } from '../../capabilities/shared/bounded-reads'
import { schoolDayStart } from '../../capabilities/subject-enrollment/dates'
import { getGuardianAssessmentResult } from './guardian-period-results'
import { filterStudentTimetableEvents } from './subject-enrollment'
import { activityEventFromSession, isInClassTimetableAssessment, lessonEventFromSession, selectedAssessmentEvent } from './timetable'

interface GuardianOccurrenceInput { studentId: string, academicYearId: string, occurrenceId: string, kind?: TimetableEventKind }
interface SelectedOccurrence { event: TimetableEvent, sessionNote?: string, activityNotes?: string, assessment?: Assessment }

async function findOccurrence(repos: Awaited<ReturnType<AccessPolicies['timetable']['studentEventRepositories']>>, input: GuardianOccurrenceInput): Promise<SelectedOccurrence | undefined> {
  const kinds = new Set<TimetableEventKind>([...(input.kind ? [input.kind] : []), 'lesson', 'activity', 'assessment'])
  for (const kind of kinds) {
    if (kind === 'lesson') {
      const row = await repos.lessonSessions.findById(input.occurrenceId)
      if (row)
        return { event: lessonEventFromSession(row), sessionNote: row.sessionNote }
    }
    else if (kind === 'activity') {
      const row = await repos.activitySessions.findById(input.occurrenceId)
      if (row)
        return { event: activityEventFromSession(row), activityNotes: row.notes }
    }
    else {
      const row = await repos.assessments.findById(input.occurrenceId)
      if (row && isInClassTimetableAssessment(row)) {
        const lesson = row.lessonSessionId && !(row.startsAt && row.endsAt) ? await repos.lessonSessions.findById(row.lessonSessionId) : undefined
        const event = selectedAssessmentEvent(row, lesson)
        if (event)
          return { event, assessment: row }
      }
    }
  }
  return undefined
}

async function lessonLogbook(base: BaseSchoolService, access: AccessPolicies, selected: SelectedOccurrence) {
  const { event, sessionNote } = selected
  if (event.kind !== 'lesson' || !event.classSubjectId)
    return null
  const progress = await base.repositories.classSubjectProgress.forAccess(await access.entity('classSubjectProgress').readScope()).list({ lessonSessionId: event.id })
  const content = guardianLogbookText(sessionNote) ?? ''
  if (!progress.length)
    return content ? { content, chapters: [] } : null
  const scopedLinks = base.repositories.classSubjectMatters.forAccess(await access.entity('classSubjectMatters').readScope())
  const links = await loadInBatches(progress.map(row => row.classSubjectMatterId), ids => scopedLinks.list({ id: { $in: ids }, classSubjectId: event.classSubjectId }))
  const scopedDefinitions = base.repositories.subjectMatters.forAccess(await access.entity('subjectMatters').readScope())
  const definitions = await loadInBatches(links.map(row => row.subjectMatterId), ids => scopedDefinitions.findByIds(ids))
  const names = new Map(definitions.map(row => [row.id, row.name]))
  const chapterNames = new Map(links.map(row => [row.id, names.get(row.subjectMatterId)]))
  return { content, chapters: progress.map(row => ({ name: chapterNames.get(row.classSubjectMatterId) ?? null, completed: row.completed, notes: row.notes ?? null })) }
}

async function assessmentDetails(base: BaseSchoolService, access: AccessPolicies, studentId: string, row?: Assessment) {
  if (!row)
    return null
  let mark: Awaited<ReturnType<typeof getGuardianAssessmentResult>>['mark'] = null
  if (row.marksStatus === 'submitted') {
    try {
      const result = await getGuardianAssessmentResult(base, { studentId, assessmentId: row.id }, access)
      mark = result.mark
    }
    catch (error) {
      if (!(error instanceof AuthorizationError))
        throw error
    }
  }
  return { description: row.description ?? null, maxScore: row.maxScore, coefficient: row.coefficient, mark }
}

export async function getGuardianOccurrenceDetail(base: BaseSchoolService, input: GuardianOccurrenceInput) {
  if (base.actor.kind !== 'guardian')
    denyResourceAccess()
  return base.atomicExecution.execute(async () => {
    const access = base.access.forOperation()
    const repos = await access.timetable.studentEventRepositories(input.studentId)
    const year = await base.repositories.academicYears.forAccess(await access.entity('academicYears').readScope()).findById(input.academicYearId)
    if (!year)
      denyResourceAccess()
    const yearPlacements = repos.placements.filter(row => row.academicYearId === year.id)
    if (!yearPlacements.length)
      return { occurrence: null }
    const selected = await findOccurrence(repos, input)
    if (!selected)
      return { occurrence: null }
    const { event } = selected
    const placements = yearPlacements.filter(row => row.classGroupId === event.classGroupId)
    if (!placements.length)
      return { occurrence: null }
    const now = new Date()
    const history = event.endsAt <= now
    const timeZone = (await base.repositories.schools.findById(base.actor.schoolId))?.timeZone ?? 'UTC'
    if (event.startsAt < schoolDayStart(year.startDate, timeZone) || event.startsAt >= schoolDayStart(year.endDate, timeZone, 1) || (history && event.status === 'cancelled'))
      return { occurrence: null }
    // Historical evidence can outlive elective selection, within the relevant placement window.
    const windowStart = schoolDayStart(event.startsAt, timeZone, -1)
    const windowEnd = schoolDayStart(event.startsAt, timeZone, 2)
    if (!placements.some(row => row.enrolledAt < windowEnd && (!row.endedAt || row.endedAt > windowStart)))
      return { occurrence: null }
    const visible = await filterStudentTimetableEvents(base, input.studentId, placements, [event], history, now)
    if (!visible.length)
      return { occurrence: null }
    const field = { lesson: 'lessonSessionId', activity: 'activitySessionId', assessment: 'assessmentId' }[event.kind]
    const scopedAttendance = base.repositories.attendance.forAccess(await access.entity('attendance').readScope())
    const [[record], logbook, assessment] = await Promise.all([
      scopedAttendance.list({ studentId: input.studentId, [field]: event.id, $limit: 1 }),
      lessonLogbook(base, access, selected),
      assessmentDetails(base, access, input.studentId, selected.assessment),
    ])
    return { occurrence: {
      id: event.id,
      kind: event.kind,
      title: event.title,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      classSubjectId: event.classSubjectId ?? null,
      subjectLabel: event.kind === 'lesson' ? event.title : null,
      status: event.status ?? null,
      attendance: record ? { id: record.id, date: record.date.toISOString().slice(0, 10), status: record.status, justificationStatus: record.justificationStatus, reason: record.reason ?? null, [field]: event.id } : null,
      logbook,
      assessment,
      activityNotes: selected.activityNotes ?? null,
    } }
  }, { readSnapshot: true })
}
