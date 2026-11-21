import type { StaffFeedbackOptionScopes } from './staff-feedback-options'
import { z } from 'zod'
import { FamilyFeedbackCampaignStatus } from '../../domain/family-feedback/campaign'

export const staffFeedbackHistoryFilter = z.object({
  academicYearId: z.string().min(1).optional(),
  lang: z.enum(['fr', 'en']),
  q: z.string().optional(),
  status: z.nativeEnum(FamilyFeedbackCampaignStatus).optional(),
})
export const staffFeedbackHistoryInput = staffFeedbackHistoryFilter.extend({ cursor: z.string().max(4096).optional() })
export const staffFeedbackHistoryRow = z.object({
  id: z.string(),
  title: z.string(),
  status: z.nativeEnum(FamilyFeedbackCampaignStatus),
  academicPeriodId: z.string(),
  opensAt: z.string().datetime().nullable(),
  closesAt: z.string().datetime().nullable(),
})
export const staffFeedbackHistoryExport = z.object({ items: z.array(staffFeedbackHistoryRow) })
export const staffFeedbackHistoryPage = staffFeedbackHistoryExport.extend({ total: z.number().int(), nextCursor: z.string().nullable() })
export const staffFeedbackHistoryPageSize = 30
export type StaffFeedbackHistoryFilter = z.infer<typeof staffFeedbackHistoryFilter>
export type StaffFeedbackHistoryInput = z.infer<typeof staffFeedbackHistoryInput>
export type StaffFeedbackHistoryRow = z.infer<typeof staffFeedbackHistoryRow>
export interface StaffFeedbackHistoryBoundary { createdAt: string, id: string }
export interface StaffFeedbackHistoryPort {
  read: (schoolId: string, filter: StaffFeedbackHistoryFilter, scopes: StaffFeedbackOptionScopes, page?: { after?: StaffFeedbackHistoryBoundary }) =>
  Promise<{ items: StaffFeedbackHistoryRow[], total: number, next: StaffFeedbackHistoryBoundary | null }>
}
