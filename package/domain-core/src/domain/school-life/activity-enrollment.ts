import { z } from 'zod'

import { parseDomain, zodDate } from '../shared/utils'

export enum ActivityEnrollmentStatus {
  Approved = 'approved',
  Pending = 'pending',
  Denied = 'denied',
}

export const activityEnrollmentBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  activityId: z.string().trim().min(1, 'activityId must not be blank'),
  studentId: z.string().trim().min(1, 'studentId must not be blank'),
  status: z.nativeEnum(ActivityEnrollmentStatus),
  createdAt: zodDate().default(() => new Date()),
})

export const activityEnrollmentSchema = activityEnrollmentBaseSchema

export type ActivityEnrollmentData = z.infer<typeof activityEnrollmentSchema>
export type ActivityEnrollmentInput = z.input<typeof activityEnrollmentSchema>

export const activityEnrollmentCreateSchema = activityEnrollmentBaseSchema.omit({ createdAt: true })
export const activityEnrollmentUpdateSchema = activityEnrollmentBaseSchema.partial().required({ id: true })

/**
 * Student enrollment in an extracurricular activity.
 */
export class ActivityEnrollment {
  readonly data: ActivityEnrollmentData

  constructor(args: ActivityEnrollmentInput) {
    this.data = parseDomain(activityEnrollmentSchema, args)
  }

  get id() { return this.data.id }
  get activityId() { return this.data.activityId }
  get studentId() { return this.data.studentId }
  get status() { return this.data.status }
  get createdAt() { return this.data.createdAt }
}
