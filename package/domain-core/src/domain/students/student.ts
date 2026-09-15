import { z } from 'zod'

import { parseDomain, zodDate } from '../shared/utils'

export enum StudentStatus {
  Active = 'active',
  Inactive = 'inactive',
  Graduated = 'graduated',
  Archived = 'archived',
}

export const studentSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  firstName: z.string().trim().min(1, 'firstName must not be blank'),
  lastName: z.string().trim().min(1, 'lastName must not be blank'),
  gender: z.string().trim().min(1, 'gender must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  birthDate: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  placeOfBirth: z.string().trim().min(1, 'placeOfBirth must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  nationality: z.string().trim().min(1, 'nationality must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  matricule: z.string().trim().min(1, 'matricule must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  photoUrl: z.string().trim().min(1, 'photoUrl must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  photoAttachmentId: z.string().trim().min(1, 'photoAttachmentId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  subjectId: z.string().trim().min(1, 'subjectId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  status: z.nativeEnum(StudentStatus).default(StudentStatus.Active),
  enrollmentDate: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

export type StudentData = z.infer<typeof studentSchema>
export type StudentInput = z.input<typeof studentSchema>

export const studentCreateSchema = studentSchema.omit({ createdAt: true })
export const studentUpdateSchema = studentSchema.partial().required({ id: true })

/**
 * Represents an individual student attending the school.
 * Holds fundamental biographical data.
 * Gender is a free-form string to allow school-specific customisation.
 */
export class Student {
  readonly data: StudentData

  constructor(args: StudentInput) {
    this.data = parseDomain(studentSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get firstName() { return this.data.firstName }
  get lastName() { return this.data.lastName }
  get gender() { return this.data.gender }
  get birthDate() { return this.data.birthDate }
  get placeOfBirth() { return this.data.placeOfBirth }
  get nationality() { return this.data.nationality }
  get matricule() { return this.data.matricule }
  get photoUrl() { return this.data.photoUrl }
  get photoAttachmentId() { return this.data.photoAttachmentId }
  get subjectId() { return this.data.subjectId }
  get status() { return this.data.status }
  get enrollmentDate() { return this.data.enrollmentDate }
  get createdAt() { return this.data.createdAt }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`
  }

  copyWith(changes: Partial<StudentInput>): Student {
    return new Student({
      id: this.id,
      schoolId: this.schoolId,
      firstName: this.firstName,
      lastName: this.lastName,
      gender: this.gender,
      birthDate: this.birthDate,
      placeOfBirth: this.placeOfBirth,
      nationality: this.nationality,
      matricule: this.matricule,
      photoUrl: this.photoUrl,
      photoAttachmentId: this.photoAttachmentId,
      subjectId: this.subjectId,
      status: this.status,
      enrollmentDate: this.enrollmentDate,
      createdAt: this.createdAt,
      ...changes,
    })
  }
}
