import type { AttendanceRecord, Filter } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import { denyResourceAccess } from '@edaya/authorization'
import { BusinessRuleViolationError } from '@edaya/core'
import { loadInBatches } from '../../capabilities/shared/bounded-reads'
import { getStudentTimetable } from './subject-enrollment'
import { buildTeacherTimetable } from './timetable'

export interface SessionHistoryInput {
  academicYearId: string
  startDate: Date
  endDate: Date
}

async function historyContext(base: BaseSchoolService, input: SessionHistoryInput, access = base.access) {
  const scope = await access.entity('academicYears').readScope()
  const year = await base.repositories.academicYears.forAccess(scope).findById(input.academicYearId)
  if (!year)
    denyResourceAccess()
  const day = (d: Date) => d.toISOString().slice(0, 10)
  if (input.endDate < input.startDate || input.endDate.getTime() - input.startDate.getTime() > 30 * 86400000)
    throw new BusinessRuleViolationError('INVALID_HISTORY_RANGE', 'History windows must be at most 31 days')
  const school = await base.repositories.schools.findById(base.actor.schoolId)
  const timeZone = school?.timeZone ?? 'UTC'
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
  const localDay = (date: Date) => formatter.format(date)
  const startDate = [day(input.startDate), day(year.startDate)].sort().at(-1)!
  const endDate = [day(input.endDate), day(year.endDate), localDay(now)].sort()[0]!
  return { startDate, endDate, timeZone, now, localDay, hasMore: startDate > day(year.startDate) }
}

function attendanceSummary(record: AttendanceRecord | undefined) {
  return record ? { status: record.status, justificationStatus: record.justificationStatus, reason: record.reason ?? null } : null
}

function logbookHasContent(raw: string | undefined) {
  if (!raw?.trim())
    return false
  if (!raw.trim().startsWith('{"edayaLogbook":'))
    return true
  try {
    const note = JSON.parse(raw).edayaLogbook
    return ['content', 'homework', 'familySummary'].some(key => typeof note[key] === 'string' && note[key].trim()) || (Array.isArray(note.objectives) && note.objectives.some((v: unknown) => typeof v === 'string' && v.trim()))
  }
  catch { return true }
}

export function getStudentSessionHistory(base: BaseSchoolService, input: SessionHistoryInput & { studentId: string }) {
  return base.atomicExecution.execute(() => readStudentHistory(base, input), { readSnapshot: true })
}

async function readStudentHistory(base: BaseSchoolService, input: SessionHistoryInput & { studentId: string }) {
  const access = base.access.forOperation()
  // Authenticate the exact child even when the requested date window is empty.
  const eventRepositories = await access.timetable.studentEventRepositories(input.studentId)
  const context = await historyContext(base, input, access)
  const { startDate, endDate, timeZone, hasMore, now } = context
  if (endDate < startDate)
    return { startDate, endDate, timeZone, hasMore: false, entries: [] }
  const timetable = await getStudentTimetable(base, { studentId: input.studentId, startDate: new Date(startDate), endDate: new Date(endDate) }, true, eventRepositories)
  const attendanceScope = await access.entity('attendance').readScope()
  const scopedAttendance = base.repositories.attendance.forAccess(attendanceScope)
  const groups = await base.repositories.classGroups.findByIds([...new Set(timetable.events.map(e => e.classGroupId))])
  const yearGroups = new Set(groups.filter(g => g.academicYearId === input.academicYearId).map(g => g.id))
  const events = timetable.events.filter(event => yearGroups.has(event.classGroupId) && event.status !== 'cancelled' && event.endsAt <= now)

  // Attendance dates are civil dates. Use occurrence anchors for session records
  // so school-local start times on a different UTC day still match.
  const anchorFields = { lesson: 'lessonSessionId', activity: 'activitySessionId', assessment: 'assessmentId' } as const
  const byOccurrence = new Map<string, AttendanceRecord>()
  const dailyRecords: AttendanceRecord[] = []
  // The authorization predicate is expensive to plan. Apply it once for a
  // typical window, including days with no timetable events.
  for (let offset = 0; offset < Math.max(1, events.length); offset += 500) {
    const filters: Filter<AttendanceRecord>[] = []
    if (offset === 0)
      filters.push({ attendanceId: { $exists: true }, date: { $gte: new Date(startDate), $lte: new Date(endDate) } })
    const chunk = events.slice(offset, offset + 500)
    for (const kind of ['lesson', 'activity', 'assessment'] as const) {
      const ids = chunk.filter(event => event.kind === kind).map(event => event.id)
      if (ids.length)
        filters.push({ [anchorFields[kind]]: { $in: ids } })
    }
    const rows = await scopedAttendance.list({ studentId: input.studentId, $or: filters })
    for (const row of rows) {
      if (row.attendanceId && !row.lessonSessionId && !row.activitySessionId && !row.assessmentId)
        dailyRecords.push(row)
      for (const [kind, field] of Object.entries(anchorFields)) {
        if (row[field])
          byOccurrence.set(`${kind}:${row[field]}`, row)
      }
    }
  }
  const entries = events.map(event => ({
    ...event,
    attendance: attendanceSummary(byOccurrence.get(`${event.kind}:${event.id}`)),
    attendanceComplete: null,
    logbookComplete: null,
  }))
  const daily = dailyRecords.map(r => ({
    id: r.id,
    kind: 'daily' as const,
    title: '',
    startsAt: r.date,
    endsAt: r.date,
    attendance: attendanceSummary(r),
    attendanceComplete: null,
    logbookComplete: null,
  }))
  return { startDate, endDate, timeZone, hasMore, entries: [...entries, ...daily].sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime() || a.id.localeCompare(b.id)) }
}

export async function getTeacherSessionHistory(base: BaseSchoolService, input: SessionHistoryInput & { teacherId: string, classGroupId?: string, classSubjectId?: string }) {
  const repositories = await base.access.timetable.teacherEventRepositories(input.teacherId)
  const context = await historyContext(base, input)
  const { startDate, endDate, timeZone, hasMore, now } = context
  if (endDate < startDate)
    return { startDate, endDate, timeZone, hasMore: false, entries: [] }
  // Query a padded UTC range, then filter by school calendar days.
  const timetable = await buildTeacherTimetable(repositories, { teacherId: input.teacherId, startDate: new Date(new Date(startDate).getTime() - 86400000), endDate: new Date(new Date(endDate).getTime() + 86400000) })
  const groups = await repositories.classGroups.findByIds([...new Set(timetable.events.map(e => e.classGroupId))])
  const yearGroups = new Set(groups.filter(g => g.academicYearId === input.academicYearId).map(g => g.id))
  const events = timetable.events.filter(e => yearGroups.has(e.classGroupId) && e.status !== 'cancelled' && e.endsAt <= now && context.localDay(e.startsAt) >= startDate && context.localDay(e.startsAt) <= endDate && (!input.classGroupId || e.classGroupId === input.classGroupId) && (!input.classSubjectId || e.classSubjectId === input.classSubjectId))
  const ids = events.filter(e => e.kind === 'lesson').map(e => e.id)
  const [lessons, records, progress, states] = await Promise.all([
    loadInBatches(ids, chunk => repositories.lessonSessions.findByIds(chunk)),
    loadInBatches(ids, chunk => base.repositories.attendance.list({ lessonSessionId: { $in: chunk } })),
    loadInBatches(ids, chunk => base.repositories.classSubjectProgress.list({ lessonSessionId: { $in: chunk } })),
    loadInBatches(ids, chunk => base.repositories.teacherCorrections.attendanceLessonStates(base.actor.schoolId, chunk)),
  ])
  const locks = new Map(states.map(row => [row.lessonId, row.locked]))
  const recorded = new Set(records.map(row => row.lessonSessionId))
  const completed = new Set(progress.filter(row => row.completed !== null).map(row => row.lessonSessionId))
  for (const lesson of lessons) {
    if (logbookHasContent(lesson.sessionNote))
      completed.add(lesson.id)
  }
  const entries = events.map(event => ({
    ...event,
    attendance: null,
    attendanceComplete: event.kind === 'lesson' ? locks.get(event.id) ?? recorded.has(event.id) : null,
    logbookComplete: event.kind === 'lesson' ? completed.has(event.id) : null,
  }))
  return { startDate, endDate, timeZone, hasMore, entries: entries.sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime() || a.id.localeCompare(b.id)) }
}
