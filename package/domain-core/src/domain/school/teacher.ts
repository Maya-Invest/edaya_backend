import { z } from 'zod'

import { parseDomain, zodDate } from '../shared/utils'
import { optionalHumanIdentifierSchema } from '../shared/visible-identification'

export const teacherSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  sourceFullName: z.string().refine(v => v.trim().length > 0).nullable().optional().transform(v => v === null ? undefined : v),
  firstName: z.string().trim().min(1, 'firstName must not be blank'),
  lastName: z.string().trim().min(1, 'lastName must not be blank'),
  identifier: optionalHumanIdentifierSchema,
  signatureAttachmentId: z.string().trim().min(1).nullable().optional().transform(v => v === null ? undefined : v),
  photoUrl: z.string().trim().min(1, 'photoUrl must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  email: z.string().trim().min(1, 'email must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  phone: z.string().trim().min(1, 'phone must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  notificationEmail: z.string().trim().min(1, 'notificationEmail must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  notificationPhone: z.string().trim().min(1, 'notificationPhone must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  subjectId: z.string().trim().min(1, 'subjectId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  isActive: z.boolean().default(true),
  createdAt: zodDate().default(() => new Date()),
})

export type TeacherData = z.infer<typeof teacherSchema>
export type TeacherInput = z.input<typeof teacherSchema>

export const teacherCreateSchema = teacherSchema.omit({ createdAt: true })
export const teacherUpdateSchema = teacherSchema.partial().required({ id: true })

/** Dedicated teacher portal actor — not a staff member. */
export class Teacher {
  readonly data: TeacherData

  constructor(args: TeacherInput) {
    this.data = parseDomain(teacherSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get sourceFullName() { return this.data.sourceFullName }
  get firstName() { return this.data.firstName }
  get lastName() { return this.data.lastName }
  get identifier() { return this.data.identifier }
  get signatureAttachmentId() { return this.data.signatureAttachmentId }
  get photoUrl() { return this.data.photoUrl }
  get email() { return this.data.email }
  get phone() { return this.data.phone }
  get notificationEmail() { return this.data.notificationEmail }
  get notificationPhone() { return this.data.notificationPhone }
  get subjectId() { return this.data.subjectId }
  get isActive() { return this.data.isActive }
  get createdAt() { return this.data.createdAt }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`
  }

  copyWith(changes: Partial<TeacherInput>): Teacher {
    return new Teacher({ ...this.data, ...changes })
  }
}

/** Teacher identity remains attached to its own optional signature through document assembly. */
export interface DocumentTeacher {
  teacherId: string
  name: string
  signatureAttachmentId?: string
  signatureUrl?: string
}

export const TEACHER_SIGNATURE_PURPOSE = 'teacher.signature'
export const TEACHER_SIGNATURE_CAPABILITY = 'capability.teacher-signature'
export const TEACHER_SIGNATURE_MAX_BYTES = 1_048_576
