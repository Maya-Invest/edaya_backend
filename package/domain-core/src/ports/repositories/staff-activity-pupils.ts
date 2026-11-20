import type { ResourceAccessScope } from './resource-access-scope'
import { z } from 'zod'
import { ActivityEnrollmentStatus } from '../../domain/school-life/activity-enrollment'

const activityPageInput = z.object({ activityId: z.string().min(1), cursor: z.string().max(4096).optional() })
export const staffActivityMembersInput = activityPageInput.extend({ selectedId: z.string().min(1).optional() })
export const staffActivityPupilOptionsInput = activityPageInput.extend({
  q: z.string().trim().max(200).optional(),
  classGroupId: z.string().min(1).optional(),
  classCursor: z.string().max(4096).optional(),
})
export const activityPupilLabel = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  identifier: z.string().nullable(),
  classGroupId: z.string().nullable(),
})
export const staffActivityMember = z.object({
  id: z.string(),
  studentId: z.string(),
  status: z.nativeEnum(ActivityEnrollmentStatus),
  student: activityPupilLabel.nullable(),
})
export const staffActivityMembersPage = z.object({
  items: z.array(staffActivityMember),
  selected: staffActivityMember.nullable(),
  total: z.number().int(),
  canAdd: z.boolean(),
  nextCursor: z.string().nullable(),
})
export const staffActivityPupilOptionsPage = z.object({
  items: z.array(activityPupilLabel),
  nextCursor: z.string().nullable(),
  classGroupIds: z.array(z.string()),
  nextClassCursor: z.string().nullable(),
})
export type StaffActivityMembersInput = z.infer<typeof staffActivityMembersInput>
export type StaffActivityPupilOptionsInput = z.infer<typeof staffActivityPupilOptionsInput>
export type StaffActivityMember = z.infer<typeof staffActivityMember>
export type ActivityPupilLabel = z.infer<typeof activityPupilLabel>
export interface ActivityPupilScopes {
  participants: ResourceAccessScope
  placements: ResourceAccessScope
  candidates?: ResourceAccessScope
  members: ResourceAccessScope
  links: ResourceAccessScope
}
export interface StaffActivityPupilsPort {
  members: (scopes: ActivityPupilScopes, input: StaffActivityMembersInput, after?: string) => Promise<{ items: StaffActivityMember[], selected: StaffActivityMember | null, total: number, canAdd: boolean }>
  options: (scopes: ActivityPupilScopes, input: StaffActivityPupilOptionsInput, after?: { name: string, id: string }, afterClass?: string) => Promise<{ items: ActivityPupilLabel[], classGroupIds: string[] }>
}
export const staffActivityPupilPageSize = 30
