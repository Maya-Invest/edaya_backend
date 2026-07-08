import { z } from 'zod'

import { Permission } from '../permissions/permission'

import { parseDomain, zodDate } from '../shared/utils'

export const staffAssignmentBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  staffId: z.string().trim().min(1, 'staffId must not be blank'),
  academicYearId: z.string().trim().min(1, 'academicYearId must not be blank'),
  responsibility: z.string().trim().min(1, 'responsibility must not be blank'),
  permissions: z.nativeEnum(Permission).array().default([]).transform(arr => Object.freeze([...new Set(arr)])),
  classGroupId: z.string().trim().min(1, 'classGroupId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  classSubjectId: z.string().trim().min(1, 'classSubjectId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  lessonSessionId: z.string().trim().min(1, 'lessonSessionId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  activitySessionId: z.string().trim().min(1, 'activitySessionId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  assessmentId: z.string().trim().min(1, 'assessmentId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

function refineStaffAssignment(
  data: {
    classGroupId?: string
    classSubjectId?: string
    lessonSessionId?: string
    activitySessionId?: string
    assessmentId?: string
  },
  ctx: z.RefinementCtx,
) {
  const targets = [data.classGroupId, data.classSubjectId, data.lessonSessionId, data.activitySessionId, data.assessmentId].filter(Boolean)
  if (targets.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A StaffAssignment must target exactly one of: classGroupId, classSubjectId, lessonSessionId, activitySessionId, or assessmentId',
    })
  }
}

export const staffAssignmentSchema = staffAssignmentBaseSchema.superRefine(refineStaffAssignment)
export type StaffAssignmentData = Omit<z.infer<typeof staffAssignmentSchema>, 'permissions'> & {
  readonly permissions: readonly Permission[]
}
export type StaffAssignmentInput = z.input<typeof staffAssignmentBaseSchema>

export const staffAssignmentCreateSchema = staffAssignmentBaseSchema.omit({ createdAt: true }).superRefine(refineStaffAssignment)
export const staffAssignmentUpdateSchema = staffAssignmentBaseSchema.partial().required({ id: true }).superRefine(refineStaffAssignment)

/**
 * Assigns a staff member (with a free-form responsibility label) to a class, subject, or occurrence.
 * Optional `permissions` sync derived `StaffPermissionAssignment` rows on save/delete.
 */
export class StaffAssignment {
  readonly data: StaffAssignmentData

  constructor(args: StaffAssignmentInput) {
    this.data = parseDomain(staffAssignmentSchema, args) as StaffAssignmentData
  }

  get id() { return this.data.id }
  get staffId() { return this.data.staffId }
  get academicYearId() { return this.data.academicYearId }
  get responsibility() { return this.data.responsibility }
  get permissions() { return this.data.permissions }
  get classGroupId() { return this.data.classGroupId }
  get classSubjectId() { return this.data.classSubjectId }
  get lessonSessionId() { return this.data.lessonSessionId }
  get activitySessionId() { return this.data.activitySessionId }
  get assessmentId() { return this.data.assessmentId }
  get createdAt() { return this.data.createdAt }
}
