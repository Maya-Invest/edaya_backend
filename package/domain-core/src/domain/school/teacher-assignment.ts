import { z } from 'zod'

import { parseDomain, zodDate } from '../shared/utils'

export enum TeacherAssignmentKind {
  Subject = 'subject',
  Homeroom = 'homeroom',
}

export enum TeacherAssignmentStatus {
  Active = 'active',
  Ended = 'ended',
}

export const teacherAssignmentBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  teacherId: z.string().trim().min(1, 'teacherId must not be blank'),
  academicYearId: z.string().trim().min(1, 'academicYearId must not be blank'),
  kind: z.nativeEnum(TeacherAssignmentKind),
  classSubjectId: z.string().trim().min(1, 'classSubjectId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  classGroupId: z.string().trim().min(1, 'classGroupId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  responsibility: z.string().trim().min(1, 'responsibility must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  status: z.nativeEnum(TeacherAssignmentStatus).default(TeacherAssignmentStatus.Active),
  startsAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  endsAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
  updatedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
})

function refineTeacherAssignment(
  data: {
    kind?: TeacherAssignmentKind
    classSubjectId?: string
    classGroupId?: string
    status?: TeacherAssignmentStatus
    endsAt?: Date
  },
  ctx: z.RefinementCtx,
) {
  if (data.kind === TeacherAssignmentKind.Subject && !data.classSubjectId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'classSubjectId is required when kind is subject',
      path: ['classSubjectId'],
    })
  }

  if (data.kind === TeacherAssignmentKind.Homeroom && !data.classGroupId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'classGroupId is required when kind is homeroom',
      path: ['classGroupId'],
    })
  }

  if (data.status === TeacherAssignmentStatus.Ended && !data.endsAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'endsAt is required when status is ended',
      path: ['endsAt'],
    })
  }
}

export const teacherAssignmentSchema = teacherAssignmentBaseSchema.superRefine(refineTeacherAssignment)
export type TeacherAssignmentData = z.infer<typeof teacherAssignmentSchema>
export type TeacherAssignmentInput = z.input<typeof teacherAssignmentBaseSchema>

export const teacherAssignmentCreateSchema = teacherAssignmentBaseSchema.omit({ createdAt: true }).superRefine(refineTeacherAssignment)
export const teacherAssignmentUpdateSchema = teacherAssignmentBaseSchema.partial().required({ id: true }).superRefine(refineTeacherAssignment)

/** Active or historical teacher placement for subject or homeroom scope. */
export class TeacherAssignment {
  readonly data: TeacherAssignmentData

  constructor(args: TeacherAssignmentInput) {
    this.data = parseDomain(teacherAssignmentSchema, args)
  }

  get id() { return this.data.id }
  get teacherId() { return this.data.teacherId }
  get academicYearId() { return this.data.academicYearId }
  get kind() { return this.data.kind }
  get classSubjectId() { return this.data.classSubjectId }
  get classGroupId() { return this.data.classGroupId }
  get responsibility() { return this.data.responsibility }
  get status() { return this.data.status }
  get startsAt() { return this.data.startsAt }
  get endsAt() { return this.data.endsAt }
  get createdAt() { return this.data.createdAt }
  get updatedAt() { return this.data.updatedAt }
}
