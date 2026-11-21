import type { ResourceAccessScope } from './resource-access-scope'
import { z } from 'zod'

export const studentDirectoryInput = z.object({
  q: z.string().max(240).optional(),
  view: z.literal('class-roster').optional(),
  classGroupId: z.string().min(1).optional(),
  periodId: z.string().min(1).optional(),
  status: z.enum(['active', 'inactive', 'graduated', 'archived']).optional(),
  photoReview: z.literal('pending').optional(),
  sort: z.enum(['roster', 'name', 'class', 'average', 'attendance', 'status']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export const studentDirectoryRow = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  identifier: z.string().nullable(),
  sourceFullName: z.string().nullable(),
  globalIdentifier: z.string().nullable(),
  placeOfBirth: z.string().nullable(),
  nationality: z.string().nullable(),
  birthdate: z.string().nullable(),
  enrollmentDate: z.string().nullable(),
  gender: z.string().nullable(),
  subjectId: z.string().nullable(),
  status: z.enum(['active', 'inactive', 'graduated', 'archived']),
  classId: z.string().nullable(),
  enrollmentId: z.string().nullable(),
  guardianName: z.string().nullable(),
  photoAttachmentId: z.string().nullable(),
  photoUrl: z.string().nullable(),
  pendingPhoto: z.boolean(),
  average: z.number().nullable(),
  attendance: z.number().nullable(),
})
export const studentDirectoryPage = z.object({
  rows: z.array(studentDirectoryRow),
  total: z.number().int().nonnegative(),
  offset: z.number().int(),
  limit: z.number().int(),
})

export type StudentDirectoryInput = z.infer<typeof studentDirectoryInput>
export type StudentDirectoryPage = z.infer<typeof studentDirectoryPage>
export const classRosterMembersInput = studentDirectoryInput.pick({ classGroupId: true, q: true, status: true }).required({ classGroupId: true })
export type ClassRosterMembersInput = z.infer<typeof classRosterMembersInput>
export const studentDirectoryRelations = ['enrollments', 'classGroups', 'guardianLinks', 'guardians', 'attendance', 'assessments', 'assessmentResults', 'studentPhotoSubmissions'] as const
export type StudentDirectoryScopes = { students: ResourceAccessScope } & Record<typeof studentDirectoryRelations[number], ResourceAccessScope | null>
export interface StudentDirectoryPort {
  revision: (schoolId: string) => Promise<string>
  page: (input: StudentDirectoryInput, scopes: StudentDirectoryScopes) => Promise<StudentDirectoryPage>
  classRosterMemberIds: (input: ClassRosterMembersInput, scopes: Pick<StudentDirectoryScopes, 'students' | 'enrollments'>) => Promise<string[]>
}
