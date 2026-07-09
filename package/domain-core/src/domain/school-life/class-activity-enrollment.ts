import type { CoreEntityRepositories } from '@edaya/core'
import { z } from 'zod'

import { parseDomain, zodDate } from '../shared/utils'

export const classActivityEnrollmentBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  activityId: z.string().trim().min(1, 'activityId must not be blank'),
  classGroupId: z.string().trim().min(1, 'classGroupId must not be blank'),
  createdAt: zodDate().default(() => new Date()),
})

export const classActivityEnrollmentSchema = classActivityEnrollmentBaseSchema

export type ClassActivityEnrollmentData = z.infer<typeof classActivityEnrollmentSchema>
export type ClassActivityEnrollmentInput = z.input<typeof classActivityEnrollmentSchema>

export const classActivityEnrollmentCreateSchema = classActivityEnrollmentBaseSchema.omit({ createdAt: true })
export const classActivityEnrollmentUpdateSchema = classActivityEnrollmentBaseSchema.partial().required({ id: true })

/**
 * Links a school activity to a class group so it can appear on that class timetable.
 * Activities with no class enrollments remain school-wide.
 */
export class ClassActivityEnrollment {
  readonly data: ClassActivityEnrollmentData

  constructor(args: ClassActivityEnrollmentInput) {
    this.data = parseDomain(classActivityEnrollmentSchema, args)
  }

  get id() { return this.data.id }
  get activityId() { return this.data.activityId }
  get classGroupId() { return this.data.classGroupId }
  get createdAt() { return this.data.createdAt }
}

export async function isActivityAvailableForClassGroup(
  activityId: string,
  classGroupId: string,
  repositories: CoreEntityRepositories,
): Promise<boolean> {
  const classEnrollments = await repositories.classActivityEnrollments.list({ activityId })
  if (classEnrollments.length === 0) {
    return true
  }
  return classEnrollments.some(enrollment => enrollment.classGroupId === classGroupId)
}
