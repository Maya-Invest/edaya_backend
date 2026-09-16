import { z } from 'zod'
import { parseDomain, zodDate } from '../shared/utils'

export enum FamilyFeedbackSlotStatus {
  Open = 'open',
  Completed = 'completed',
}

export const familyFeedbackSlotSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  campaignId: z.string().trim().min(1, 'campaignId must not be blank'),
  studentId: z.string().trim().min(1, 'studentId must not be blank'),
  teacherAssignmentId: z.string().trim().min(1, 'teacherAssignmentId must not be blank'),
  status: z.nativeEnum(FamilyFeedbackSlotStatus).default(FamilyFeedbackSlotStatus.Open),
  completingGuardianId: z.string().trim().min(1, 'completingGuardianId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  completedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

export type FamilyFeedbackSlotData = z.infer<typeof familyFeedbackSlotSchema>
export type FamilyFeedbackSlotInput = z.input<typeof familyFeedbackSlotSchema>

export function familyFeedbackSlotId(campaignId: string, studentId: string): string {
  return `ffs:${campaignId}:${studentId}`
}

export class FamilyFeedbackSlot {
  readonly data: FamilyFeedbackSlotData

  constructor(args: FamilyFeedbackSlotInput) {
    this.data = parseDomain(familyFeedbackSlotSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get campaignId() { return this.data.campaignId }
  get studentId() { return this.data.studentId }
  get teacherAssignmentId() { return this.data.teacherAssignmentId }
  get status() { return this.data.status }
  get completingGuardianId() { return this.data.completingGuardianId }
  get completedAt() { return this.data.completedAt }
  get createdAt() { return this.data.createdAt }

  get isCompleted() {
    return this.status === FamilyFeedbackSlotStatus.Completed
  }

  copyWith(changes: Partial<FamilyFeedbackSlotInput>): FamilyFeedbackSlot {
    return new FamilyFeedbackSlot({ ...this.data, ...changes })
  }
}
