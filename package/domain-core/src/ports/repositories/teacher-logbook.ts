import { z } from 'zod'

export const teacherLogbookPageSize = 30
export const teacherLogbookInput = z.object({
  classGroupId: z.string().min(1),
  classSubjectId: z.string().min(1),
  view: z.enum(['recorded', 'all']),
  cursor: z.string().max(4096).optional(),
})
export const teacherLogbookItem = z.object({ id: z.string(), displayLabel: z.string(), startsAt: z.string().datetime(), recorded: z.boolean() })
export const teacherLogbookPage = z.object({ items: z.array(teacherLogbookItem), nextCursor: z.string().nullable() })
export type TeacherLogbookInput = z.infer<typeof teacherLogbookInput>
export type TeacherLogbookItem = z.infer<typeof teacherLogbookItem>
export interface TeacherLogbookPort {
  list: (schoolId: string, input: TeacherLogbookInput, after?: { startsAt: string, id: string }) => Promise<TeacherLogbookItem[]>
}
