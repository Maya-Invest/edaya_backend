import type { ResourceAccessScope } from './resource-access-scope'
import { z } from 'zod'
import { AssessmentKind } from '../../domain/assessments/assessment'
import { AttendanceStatus } from '../../domain/scheduling/attendance-record'

export const studentAttendanceHistoryInput = z.object({
  studentId: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().min(1).optional(),
})
export const studentGradeHistoryInput = studentAttendanceHistoryInput.extend({ subject: z.string().min(1).optional() })
const count = z.number().int().nonnegative()
export const studentAttendanceHistoryRow = z.object({
  id: z.string(),
  date: z.string(),
  time: z.string().nullable(),
  label: z.string().nullable(),
  eventKind: z.enum(['daily', 'lesson', 'activity', 'assessment']),
  status: z.nativeEnum(AttendanceStatus),
})
export const studentAttendanceHistoryPage = z.object({
  items: studentAttendanceHistoryRow.array(),
  present: count,
  absent: count,
  late: count,
  nextCursor: z.string().nullable(),
})
export const studentGradeHistoryRow = z.object({
  id: z.string(),
  assessmentId: z.string(),
  classGroupId: z.string(),
  title: z.string(),
  subject: z.string(),
  date: z.string(),
  score: z.number().nullable(),
  coefficient: z.number(),
  outOf: z.number(),
  kind: z.nativeEnum(AssessmentKind),
})
const gradeTotals = z.object({ total: count, graded: count, average: z.number().nullable() })
export const studentGradeHistoryPage = gradeTotals.extend({
  subjects: gradeTotals.extend({ subject: z.string() }).array(),
  items: studentGradeHistoryRow.array(),
  nextCursor: z.string().nullable(),
})
export type StudentAttendanceHistoryInput = z.infer<typeof studentAttendanceHistoryInput>
export type StudentGradeHistoryInput = z.infer<typeof studentGradeHistoryInput>
export interface HistoryBoundary { order: string, id: string }
export type AttendanceHistoryScopes = { attendance: ResourceAccessScope } & Record<'attendances' | 'lessonSessions' | 'activitySessions' | 'assessments', ResourceAccessScope | null>
export type GradeHistoryScopes = { assessmentResults: ResourceAccessScope, assessments: ResourceAccessScope } & Record<'classSubjects' | 'subjects', ResourceAccessScope | null>
export interface StudentHistoryPort {
  /** Null means the pupil is outside the caller's scope. A positive count is capped and still requires the scoped history read. */
  candidateCount: (studentId: string, students: ResourceAccessScope, resource: 'attendance' | 'assessmentResults', cap: number) => Promise<number | null>
  shortAttendanceHistory: (studentId: string, scopes: AttendanceHistoryScopes) => Promise<z.infer<typeof studentAttendanceHistoryPage>>
  attendancePage: (input: StudentAttendanceHistoryInput, scopes: AttendanceHistoryScopes, after?: HistoryBoundary) => Promise<z.infer<typeof studentAttendanceHistoryPage>>
  gradesPage: (input: StudentGradeHistoryInput, scopes: GradeHistoryScopes, after?: HistoryBoundary) => Promise<z.infer<typeof studentGradeHistoryPage>>
}
