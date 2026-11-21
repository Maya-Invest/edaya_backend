import type { ResourceAccessScope } from './resource-access-scope'
import { z } from 'zod'

export const staffFeedbackOptionsInput = z.object({
  academicYearId: z.string().min(1),
  picker: z.enum(['both', 'assignments', 'moderators']),
  q: z.string().trim().max(200).optional(),
  after: z.string().min(1).optional(),
})
export type StaffFeedbackOptionsInput = z.infer<typeof staffFeedbackOptionsInput>

export const feedbackAssignmentChoice = z.object({
  id: z.string(),
  teacherName: z.string().nullable(),
  subjectName: z.string().nullable(),
  classGroupId: z.string().nullable(),
})
export const feedbackModeratorChoice = z.object({ id: z.string(), name: z.string() })
export const staffFeedbackOptionsPage = z.object({
  assignments: z.array(feedbackAssignmentChoice),
  moderators: z.array(feedbackModeratorChoice),
  nextAssignment: z.string().nullable(),
  nextModerator: z.string().nullable(),
})
export type StaffFeedbackOptionScopes = Partial<Record<'teacherAssignments' | 'teachers' | 'classSubjects' | 'subjects' | 'staffMembers' | 'classGroups', ResourceAccessScope>>
export interface StaffFeedbackOptionsPort {
  page: (schoolId: string, input: StaffFeedbackOptionsInput, scopes: StaffFeedbackOptionScopes) => Promise<z.infer<typeof staffFeedbackOptionsPage>>
}
