import type { ResourceAccessScope } from './resource-access-scope'
import { z } from 'zod'
import { calculatedGradeSchema } from '../../domain/school/grading-policy'

export const classReportRosterInput = z.object({
  classGroupId: z.string().min(1),
  periodId: z.string().min(1),
  q: z.string().trim().max(200).optional(),
  status: z.enum(['none', 'draft', 'published']).optional(),
  view: z.enum(['roster', 'summary']).optional(),
  cursor: z.string().max(4096).optional(),
})

export const classReportHeader = z.object({
  id: z.string(),
  status: z.enum(['draft', 'published']),
  hasComment: z.boolean(),
  overallAverage: z.number().nullable(),
  grading: calculatedGradeSchema.nullable(),
  aggregateLabel: z.string().nullable(),
  rank: z.number().int().nullable(),
  classSize: z.number().int().nullable(),
})
export const classReportRosterRow = z.object({
  studentId: z.string(),
  studentName: z.string(),
  photoUrl: z.string().nullable(),
  report: classReportHeader.nullable(),
})
export const classReportTotals = z.object({
  generatedCount: z.number().int(),
  publishedCount: z.number().int(),
  commentFilledCount: z.number().int(),
  remainingFields: z.number().int(),
})
export const classReportRosterPage = z.object({
  items: z.array(classReportRosterRow),
  totals: classReportTotals,
  matchedPupils: z.number().int(),
  missingValues: z.boolean(),
  missingGrading: z.boolean(),
  nextCursor: z.string().nullable(),
})

export type ClassReportRosterInput = z.infer<typeof classReportRosterInput>
export type ClassReportRosterPage = z.infer<typeof classReportRosterPage>
export interface ClassReportRosterScopes {
  academicYearId: string
  students: ResourceAccessScope
  enrollments: ResourceAccessScope
  results: ResourceAccessScope
  isTeacher: boolean
  homeroom: boolean
  subjectIds: string[]
}
export interface ClassReportRosterPort {
  read: (scopes: ClassReportRosterScopes, input: ClassReportRosterInput, after?: { name: string, id: string }) => Promise<Omit<ClassReportRosterPage, 'nextCursor'>>
}
export const classReportRosterPageSize = 30
