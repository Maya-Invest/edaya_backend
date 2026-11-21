import type { CoreEntityKey, StudentAttendanceHistoryInput, StudentGradeHistoryInput } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import { AuthorizationError, denyResourceAccess } from '@edaya/authorization'
import { DomainValidationError, studentAttendanceHistoryInput, studentGradeHistoryInput } from '@edaya/core'
import { z } from 'zod'

const cursorFields = z.tuple([z.string(), z.string(), z.string().nullable(), z.string(), z.string().min(1)])
function readBoundary(kind: 'attendance' | 'grades', input: StudentGradeHistoryInput) {
  if (input.cursor === undefined)
    return undefined
  try {
    const [tab, student, subject, order, id] = cursorFields.parse(JSON.parse(input.cursor))
    if (tab === kind && student === input.studentId && subject === (input.subject ?? null))
      return { order, id }
  }
  catch { /* Malformed and mismatched cursors share one public error. */ }
  throw new DomainValidationError('Invalid student history cursor')
}

function staffAccess(base: BaseSchoolService) {
  if (base.actor.kind !== 'staff' || base.actor.accountKind !== 'human')
    denyResourceAccess()
  return base.access.forOperation()
}

async function labelScope(access: BaseSchoolService['access'], resource: CoreEntityKey) {
  try {
    return await access.entity(resource).readScope()
  }
  catch (error) {
    if (error instanceof AuthorizationError)
      return null
    throw error
  }
}

export async function getStudentAttendanceHistory(base: BaseSchoolService, args: StudentAttendanceHistoryInput) {
  const input = studentAttendanceHistoryInput.parse(args)
  const after = readBoundary('attendance', input)
  return base.atomicExecution.execute(async () => {
    const access = staffAccess(base)
    const [students, attendance] = await Promise.all([access.entity('students').readScope(), access.entity('attendance').readScope()])
    const limit = input.limit ?? 30
    const store = base.repositories.studentHistory
    const candidates = await store.candidateCount(input.studentId, students, 'attendance', limit + 1)
    if (candidates === null)
      denyResourceAccess()
    if (candidates === 0)
      return { present: 0, absent: 0, late: 0, items: [], nextCursor: null }
    const [attendances, lessonSessions, activitySessions, assessments] = await Promise.all([
      labelScope(access, 'attendances'),
      labelScope(access, 'lessonSessions'),
      labelScope(access, 'activitySessions'),
      labelScope(access, 'assessments'),
    ])
    const scopes = { attendance, attendances, lessonSessions, activitySessions, assessments }
    if (!after && candidates <= limit)
      return store.shortAttendanceHistory(input.studentId, scopes)
    return store.attendancePage(input, scopes, after)
  }, { readSnapshot: true })
}

export async function getStudentGradeHistory(base: BaseSchoolService, args: StudentGradeHistoryInput) {
  const input = studentGradeHistoryInput.parse(args)
  const after = readBoundary('grades', input)
  return base.atomicExecution.execute(async () => {
    const access = staffAccess(base)
    const [students, assessmentResults, assessments] = await Promise.all([
      access.entity('students').readScope(),
      access.entity('assessmentResults').readScope(),
      access.entity('assessments').readScope(),
    ])
    const candidates = await base.repositories.studentHistory.candidateCount(input.studentId, students, 'assessmentResults', 1)
    if (candidates === null)
      denyResourceAccess()
    if (candidates === 0)
      return { total: 0, graded: 0, average: null, subjects: [], items: [], nextCursor: null }
    const [classSubjects, subjects] = await Promise.all([
      labelScope(access, 'classSubjects'),
      labelScope(access, 'subjects'),
    ])
    return base.repositories.studentHistory.gradesPage(input, { assessmentResults, assessments, classSubjects, subjects }, after)
  }, { readSnapshot: true })
}
