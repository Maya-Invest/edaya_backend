import { z } from 'zod'

import { parseDomain, zodDate } from '../shared/utils'

export enum AnnouncementTargetKind {
  School = 'school',
  AllStaff = 'all_staff',
  AllGuardians = 'all_guardians',
  AllStudents = 'all_students',
  ClassGroup = 'class_group',
  GradeLevel = 'grade_level',
  StaffMember = 'staff_member',
  Guardian = 'guardian',
  Student = 'student',
}

export const announcementTargetBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  announcementId: z.string().trim().min(1, 'announcementId must not be blank'),
  targetKind: z.nativeEnum(AnnouncementTargetKind),
  targetId: z.string().trim().min(1, 'targetId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

function refineAnnouncementTarget(data: any, ctx: z.RefinementCtx) {
  const isBroadcast = [
    AnnouncementTargetKind.School,
    AnnouncementTargetKind.AllStaff,
    AnnouncementTargetKind.AllGuardians,
    AnnouncementTargetKind.AllStudents,
  ].includes(data.targetKind)
  if (isBroadcast && data.targetId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'broadcast announcement targets must not define targetId',
    })
  }
  if (!isBroadcast && !data.targetId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'scoped announcement targets must define targetId',
    })
  }
}

export const announcementTargetSchema = announcementTargetBaseSchema.superRefine(refineAnnouncementTarget)

export type AnnouncementTargetData = z.infer<typeof announcementTargetSchema>
export type AnnouncementTargetInput = z.input<typeof announcementTargetSchema>

export const announcementTargetCreateSchema = announcementTargetBaseSchema.omit({ createdAt: true }).superRefine(refineAnnouncementTarget)
export const announcementTargetUpdateSchema = announcementTargetBaseSchema.partial().required({ id: true }).superRefine(refineAnnouncementTarget)

/**
 * Resolves a published or custom announcement to a concrete audience target.
 */
export class AnnouncementTarget {
  readonly data: AnnouncementTargetData

  constructor(args: AnnouncementTargetInput) {
    this.data = parseDomain(announcementTargetSchema, args)
  }

  get id() { return this.data.id }
  get announcementId() { return this.data.announcementId }
  get targetKind() { return this.data.targetKind }
  get targetId() { return this.data.targetId }
  get createdAt() { return this.data.createdAt }
}
