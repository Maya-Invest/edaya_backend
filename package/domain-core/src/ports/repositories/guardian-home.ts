import type { ResourceAccessScope } from './resource-access-scope'
import { z } from 'zod'

export const guardianHighlightsInput = z.object({
  studentId: z.string().min(1),
  academicYearId: z.string().min(1),
  classGroupId: z.string().min(1).optional(),
  day: z.string().date(),
})

export const guardianHighlights = z.object({
  attendance: z.record(z.string(), z.string()),
  cards: z.object({
    absent: z.number(),
    late: z.number(),
    overdue: z.number(),
    balance: z.number(),
    dueDate: z.string().nullable(),
    reports: z.number(),
    marks: z.number(),
    unread: z.number(),
    photo: z.string().nullable(),
    documents: z.number(),
    progress: z.number().nullable(),
    surveys: z.number(),
  }).partial(),
  unavailable: z.array(z.enum(['attendance', 'fees', 'results', 'inbox', 'child', 'progress', 'surveys'])),
})

export const guardianChoices = z.object({
  guardianId: z.string(),
  school: z.object({ id: z.string(), name: z.string(), timeZone: z.string() }),
  children: z.array(z.object({
    id: z.string(),
    schoolId: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    status: z.string(),
    identifier: z.string().nullable(),
    photoUrl: z.string().nullable(),
  })),
  years: z.array(z.object({ id: z.string(), schoolId: z.string(), name: z.string(), startDate: z.string(), endDate: z.string(), status: z.string() })),
  enrollments: z.array(z.object({
    studentId: z.string(),
    academicYearId: z.string(),
    classGroupId: z.string(),
    status: z.string(),
    enrollmentIndex: z.number().int(),
    classLabel: z.string(),
  })),
})

export type GuardianHighlightsInput = z.infer<typeof guardianHighlightsInput>
export type GuardianHighlights = z.infer<typeof guardianHighlights>
export const guardianHomeResources = ['attendance', 'studentCharges', 'results', 'assessmentResults', 'messageDeliveries', 'studentPhotoSubmissions', 'subjectEnrollments', 'classSubjects'] as const
export type GuardianHomeScopes = Record<typeof guardianHomeResources[number] | 'documentIssuances', ResourceAccessScope | null>
export interface GuardianHomePort {
  highlights: (input: GuardianHighlightsInput & {
    schoolId: string
    subjectId: string
    now: Date
    start: Date
    end: Date
    paperTemplates: readonly string[]
  }, scopes: GuardianHomeScopes) => Promise<GuardianHighlights>
}
