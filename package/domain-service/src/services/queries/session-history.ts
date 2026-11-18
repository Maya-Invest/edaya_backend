import type { AttendanceRecord } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import type { TimetableEvent } from './timetable'
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

async function historyContext(base: BaseSchoolService, input: SessionHistoryInput) {
  const scope = await base.access.entity('academicYears').readScope()
  const year = await base.repositories.academicYears.forAccess(scope).findById(input.academicYearId)
  if (!year)
    denyResourceAccess()
  const day = (d: Date) => d.toISOString().slice(0, 10)
  if (input.endDate < input.startDate || input.endDate.getTime() - input.startDate.getTime() > 30 * 86400000)
    throw new BusinessRuleViolationError('INVALID_HISTORY_RANGE', 'History windows must be at most 31 days')
  const school = await base.repositories.schools.findById(base.actor.schoolId)
  const timeZone = school?.timeZone ?? 'UTC'
  const now = new Date()
  const localDay = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
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

export async function getStudentSessionHistory(base: BaseSchoolService, input: SessionHistoryInput & { studentId: string }) {
  // Authenticate the exact child even when the requested date window is empty.
  await base.access.timetable.studentEventRepositories(input.studentId)
  const context = await historyContext(base, input)
  const { startDate, endDate, timeZone, hasMore, now } = context
  if (endDate < startDate)
    return { startDate, endDate, timeZone, hasMore: false, entries: [] }
  const timetable = await getStudentTimetable(base, { studentId: input.studentId, startDate: new Date(startDate), endDate: new Date(endDate) }, true)
  const attendanceScope = await base.access.entity('attendance').readScope()
  const scopedAttendance = base.repositories.attendance.forAccess(attendanceScope)
  const groups = await base.repositories.classGroups.findByIds([...new Set(timetable.events.map(e => e.classGroupId))])
  const yearGroups = new Set(groups.filter(g => g.academicYearId === input.academicYearId).map(g => g.id))
  const events = timetable.events.filter(event => yearGroups.has(event.classGroupId) && event.status !== 'cancelled' && event.endsAt <= now)

  // Attendance dates are civil dates. Use occurrence anchors for session records
  // so school-local start times on a different UTC day still match.
  const anchorFields = { lesson: 'lessonSessionId', activity: 'activitySessionId', assessment: 'assessmentId' } as const
  const byOccurrence = new Map<string, AttendanceRecord>()
  const loadOccurrences = async (kind: TimetableEvent['kind']) => {
    const field = anchorFields[kind]
    const ids = events.filter(event => event.kind === kind).map(event => event.id)
    const rows = await loadInBatches(ids, chunk => scopedAttendance.list({ studentId: input.studentId, [field]: { $in: chunk } }))
    for (const record of rows)
      byOccurrence.set(`${kind}:${record[field]}`, record)
  }
  const [dailyRecords] = await Promise.all([
    scopedAttendance.list({ studentId: input.studentId, date: { $gte: new Date(startDate), $lte: new Date(endDate) } }),
    loadOccurrences('lesson'),
    loadOccurrences('activity'),
    loadOccurrences('assessment'),
  ])
  const entries = events.map(event => ({
    ...event,
    attendance: attendanceSummary(byOccurrence.get(`${event.kind}:${event.id}`)),
    attendanceComplete: null,
    logbookComplete: null,
  }))
  const daily = dailyRecords.filter(r => r.attendanceId && !r.lessonSessionId && !r.activitySessionId && !r.assessmentId).map(r => ({
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
  const [lessons, records, progress] = await Promise.all([
    loadInBatches(ids, chunk => repositories.lessonSessions.findByIds(chunk)),
    loadInBatches(ids, chunk => base.repositories.attendance.list({ lessonSessionId: { $in: chunk } })),
    loadInBatches(ids, chunk => base.repositories.classSubjectProgress.list({ lessonSessionId: { $in: chunk } })),
  ])
  const entries = await Promise.all(events.map(async (event) => {
    const state = event.kind === 'lesson' ? await base.repositories.teacherCorrections.state(base.actor.schoolId, 'attendance', `lesson:${event.id}`) : undefined
    return { ...event, attendance: null, attendanceComplete: event.kind !== 'lesson' ? null : state?.locked ?? records.some(r => r.lessonSessionId === event.id), logbookComplete: event.kind !== 'lesson' ? null : logbookHasContent(lessons.find(l => l.id === event.id)?.sessionNote) || progress.some(p => p.lessonSessionId === event.id && p.completed !== null) }
  }))
  return { startDate, endDate, timeZone, hasMore, entries: entries.sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime() || a.id.localeCompare(b.id)) }
}
