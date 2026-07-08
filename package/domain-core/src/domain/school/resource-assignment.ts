import { z } from 'zod'

import { parseDomain, zodDate } from '../shared/utils'

export const resourceAssignmentBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  resourceId: z.string().trim().min(1, 'resourceId must not be blank'),
  lessonSessionId: z.string().trim().min(1, 'lessonSessionId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  activitySessionId: z.string().trim().min(1, 'activitySessionId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  assessmentId: z.string().trim().min(1, 'assessmentId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  classGroupId: z.string().trim().min(1, 'classGroupId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

function refineResourceAssignment(
  data: {
    lessonSessionId?: string
    activitySessionId?: string
    assessmentId?: string
    classGroupId?: string
  },
  ctx: z.RefinementCtx,
) {
  const targets = [data.lessonSessionId, data.activitySessionId, data.assessmentId, data.classGroupId].filter(Boolean)
  if (targets.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A ResourceAssignment must target exactly one of: lessonSessionId, activitySessionId, assessmentId, or classGroupId',
    })
  }
}

export const resourceAssignmentSchema = resourceAssignmentBaseSchema.superRefine(refineResourceAssignment)
export type ResourceAssignmentData = z.infer<typeof resourceAssignmentSchema>
export type ResourceAssignmentInput = z.input<typeof resourceAssignmentSchema>

export const resourceAssignmentCreateSchema = resourceAssignmentBaseSchema.omit({ createdAt: true }).superRefine(refineResourceAssignment)
export const resourceAssignmentUpdateSchema = resourceAssignmentBaseSchema.partial().required({ id: true }).superRefine(refineResourceAssignment)

/**
 * Assigns a specific Resource (like a room or equipment) to a lesson occurrence or ClassGroup.
 */
export class ResourceAssignment {
  readonly data: ResourceAssignmentData

  constructor(args: ResourceAssignmentInput) {
    this.data = parseDomain(resourceAssignmentSchema, args)
  }

  get id() { return this.data.id }
  get resourceId() { return this.data.resourceId }
  get lessonSessionId() { return this.data.lessonSessionId }
  get activitySessionId() { return this.data.activitySessionId }
  get assessmentId() { return this.data.assessmentId }
  get classGroupId() { return this.data.classGroupId }
  get createdAt() { return this.data.createdAt }
}
