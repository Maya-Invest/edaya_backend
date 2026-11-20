import type { ResourceAccessScope } from './resource-access-scope'
import { z } from 'zod'
import { ActivityCategory } from '../../domain/school-life/activity'

export const staffActivityListFilter = z.object({
  category: z.string().optional(),
  q: z.string().optional(),
  sort: z.enum(['roster', 'name', 'category', 'coach', 'period', 'enrolled']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
})
export const staffActivityListInput = staffActivityListFilter.extend({ cursor: z.string().max(4096).optional() })
export const staffActivityListRow = z.object({
  id: z.string(),
  name: z.string(),
  category: z.nativeEnum(ActivityCategory),
  coach: z.string(),
  schedule: z.string(),
  capacity: z.number().int(),
  description: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  enrollmentCount: z.number().int(),
})
export const staffActivityListExport = z.object({ items: z.array(staffActivityListRow) })
export const staffActivityListPage = staffActivityListExport.extend({ nextCursor: z.string().nullable(), total: z.number().int() })
export type StaffActivityListFilter = z.infer<typeof staffActivityListFilter>
export type StaffActivityListInput = z.infer<typeof staffActivityListInput>
export type StaffActivityListRow = z.infer<typeof staffActivityListRow>
export interface ActivityMembershipCounts {
  forActivities: (scope: ResourceAccessScope, activityIds: string[]) => Promise<Map<string, number>>
}
