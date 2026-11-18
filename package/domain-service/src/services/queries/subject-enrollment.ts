import type { BaseSchoolService } from '../base-school-service'
import { denyResourceAccess } from '@edaya/authorization'
import { assessmentDate } from '../../capabilities/academics/marks-state'
import { loadInBatches } from '../../capabilities/shared/bounded-reads'
import { schoolDayStart } from '../../capabilities/subject-enrollment/dates'
import { loadParticipation, placementEffectiveAt, subjectRoster } from '../../capabilities/subject-enrollment/participation'
import { buildClassGroupTimetable } from './timetable'

export async function getStudentSubjectEnrollments(base: BaseSchoolService, input: { studentId: string, academicYearId?: string }) {
  const scoped = await base.access.subjectParticipation.context()
  const placements = await scoped.placements.list({ studentId: input.studentId, ...(input.academicYearId ? { academicYearId: input.academicYearId } : {}) })
  if (!placements.length && !await scoped.students.findById(input.studentId))
    denyResourceAccess()
  const ids = placements.map(row => row.id)
  const offerings = ids.length ? await scoped.classSubjects.list({ classGroupId: { $in: [...new Set(placements.map(row => row.classGroupId))] } }) : []
  const subjects = await base.repositories.subjects.findByIds([...new Set(offerings.map(row => row.subjectId))])
  const bySubject = new Map(subjects.map(row => [row.id, row]))
  const enrollments = ids.length ? await scoped.subjectEnrollments.list({ studentClassEnrollmentId: { $in: ids } }) : []
  return {
    studentId: input.studentId,
    enrollments: enrollments.filter(row => !row.deletedAt).map(row => row.data),
    periods: (await base.repositories.academicPeriods.list({ academicYearId: { $in: [...new Set(placements.map(row => row.academicYearId))] } })).map(row => row.data),
    offerings: offerings.map(row => ({ ...row.data, name: bySubject.get(row.subjectId)?.name ?? row.subjectId, isOptional: bySubject.get(row.subjectId)?.isOptional ?? false })),
    placements: placements.map(row => row.data),
  }
}

export async function getClassSubjectRoster(base: BaseSchoolService, input: { classSubjectId: string, at: Date }) {
  const scoped = await base.access.subjectParticipation.context()
  const offering = await scoped.classSubjects.findById(input.classSubjectId)
  if (!offering)
    denyResourceAccess()
  const group = await base.repositories.classGroups.findById(offering.classGroupId)
  const school = group ? await base.repositories.schools.findById(group.schoolId) : undefined
  const periods = group ? (await base.repositories.academicPeriods.list({ academicYearId: group.academicYearId })).map(row => row.data) : []
  const zone = school?.timeZone ?? 'UTC'
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  if (input.at < schoolDayStart(new Date(today), zone))
    return { classSubjectId: offering.id, at: input.at, revision: offering.participationRevision, count: null, basis: 'unavailable' as const, periods, students: [], enrollments: [] }
  // The enrollment scope controls both roster identities and counts, independently of curriculum read access.
  const rows = await scoped.subjectEnrollments.list({ classSubjectId: offering.id })
  const placements = await base.repositories.enrollments.findByIds([...new Set(rows.map(row => row.studentClassEnrollmentId))])
  const studentIds = subjectRoster({ placements: new Map(placements.map(row => [row.id, row])), enrollments: rows }, offering.id, input.at)
  const students = await base.repositories.students.findByIds(studentIds)
  return { classSubjectId: offering.id, at: input.at, revision: offering.participationRevision, count: students.length, basis: 'current_selection' as const, periods, students: students.map(row => ({ id: row.id, firstName: row.firstName, lastName: row.lastName })), enrollments: rows.filter(row => row.effectiveAt(input.at)).map(row => row.data) }
}

export async function getStudentTimetable(base: BaseSchoolService, input: { studentId: string, startDate: Date, endDate: Date }, includeUnrecordedHistory = false) {
  const eventRepositories = await base.access.timetable.studentEventRepositories(input.studentId)
  const student = await base.repositories.students.findById(input.studentId)
  if (!student)
    denyResourceAccess()
  const school = await base.repositories.schools.findById(student.schoolId)
  const rangeStart = schoolDayStart(input.startDate, school?.timeZone ?? 'UTC')
  const rangeEnd = schoolDayStart(input.endDate, school?.timeZone ?? 'UTC', 1)
  const placements = eventRepositories.placements
  const groups = [...new Set(placements.filter(row => row.enrolledAt < rangeEnd && (!row.endedAt || row.endedAt > rangeStart)).map(row => row.classGroupId))]
  const context = await loadParticipation(base.repositories, groups)
  const timetables = await Promise.all(groups.map(classGroupId => buildClassGroupTimetable(eventRepositories, { startDate: rangeStart, endDate: new Date(rangeEnd.getTime() - 1), classGroupId })))
  const candidates = timetables.flatMap(t => t.events).filter(event => event.startsAt >= rangeStart && event.startsAt < rangeEnd)
  const assessments = await loadInBatches(candidates.filter(event => event.kind === 'assessment').map(event => event.id), ids => base.repositories.assessments.findByIds(ids))
  const sessions = new Map((await loadInBatches(assessments.flatMap(row => row.lessonSessionId ? [row.lessonSessionId] : []), ids => base.repositories.lessonSessions.findByIds(ids))).map(row => [row.id, row]))
  const assessmentDates = new Map(await Promise.all(assessments.map(async row => [row.id, await assessmentDate(row, { lessonSessions: { findById: async id => sessions.get(id) } })] as const)))
  const now = new Date()
  const past = candidates.filter(event => event.startsAt < now)
  const [attendance, marks, calls, linkedAssessments] = await Promise.all([
    base.repositories.attendance.list({ studentId: student.id }),
    base.repositories.assessmentResults.list({ studentId: student.id }),
    Promise.all(past.filter(event => event.kind === 'lesson').map(async event => [event.id, await base.repositories.teacherCorrections.state(student.schoolId, 'attendance', `lesson:${event.id}`)] as const)),
    loadInBatches(past.filter(event => event.kind === 'lesson').map(event => event.id), ids => base.repositories.assessments.list({ lessonSessionId: { $in: ids } })),
  ])
  const savedLessons = new Set(attendance.flatMap(row => row.lessonSessionId ? [row.lessonSessionId] : []))
  for (const [id, call] of calls) {
    const { entries: savedEntries = [], rosterStudentIds = [] } = call?.payload ?? {}
    const entries = savedEntries as Array<{ studentId: string }>
    const roster = rosterStudentIds as string[]
    if (entries.some(row => row.studentId === student.id) || (call?.locked && roster.includes(student.id)))
      savedLessons.add(id)
  }
  const savedAssessments = new Set([...marks.map(row => row.assessmentId), ...attendance.flatMap(row => row.assessmentId ? [row.assessmentId] : []), ...[...assessments, ...linkedAssessments].filter(row => row.marksStatus !== 'draft' && row.marksReview.rosterStudentIds.includes(student.id)).map(row => row.id)])
  for (const assessment of linkedAssessments) {
    if (assessment.lessonSessionId && savedAssessments.has(assessment.id))
      savedLessons.add(assessment.lessonSessionId)
  }
  const events = candidates.filter((event) => {
    if (!event.classSubjectId)
      return placements.some(row => row.classGroupId === event.classGroupId && placementEffectiveAt(row, event.startsAt))
    if (event.startsAt < now) {
      const saved = event.kind === 'assessment' ? savedAssessments.has(event.id) : savedLessons.has(event.id)
      return saved || (includeUnrecordedHistory && subjectRoster(context, event.classSubjectId, assessmentDates.get(event.id) ?? event.startsAt).includes(student.id))
    }
    return subjectRoster(context, event.classSubjectId, assessmentDates.get(event.id) ?? event.startsAt).includes(student.id)
  })
  events.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
  return { studentId: student.id, startDate: input.startDate.toISOString().slice(0, 10), endDate: input.endDate.toISOString().slice(0, 10), events }
}
