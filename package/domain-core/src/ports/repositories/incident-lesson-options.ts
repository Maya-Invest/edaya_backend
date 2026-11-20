import type { ResourceAccessScope } from './resource-access-scope'
import { z } from 'zod'

export const incidentLessonOptionsInput = z.object({
  classGroupId: z.string().min(1),
  q: z.string().trim().max(200).optional(),
  selectedId: z.string().min(1).optional(),
  cursor: z.string().max(4096).optional(),
})
export const incidentLessonOption = z.object({ id: z.string(), displayLabel: z.string(), startsAt: z.string() })
export const incidentLessonOptionsPage = z.object({
  items: z.array(incidentLessonOption),
  selected: incidentLessonOption.nullable(),
  nextCursor: z.string().nullable(),
})
export type IncidentLessonOptionsInput = z.infer<typeof incidentLessonOptionsInput>
export type IncidentLessonOption = z.infer<typeof incidentLessonOption>
export interface IncidentLessonOptionsPort {
  read: (scope: ResourceAccessScope, input: IncidentLessonOptionsInput, after?: string) => Promise<{ items: IncidentLessonOption[], selected: IncidentLessonOption | null }>
}
export const incidentLessonOptionsPageSize = 30
