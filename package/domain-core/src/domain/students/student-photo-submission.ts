import { z } from 'zod'

import { parseDomain, zodDate } from '../shared/utils'

export enum StudentPhotoSubmissionStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  Superseded = 'superseded',
  Withdrawn = 'withdrawn',
}

export const studentPhotoSubmissionSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  studentId: z.string().trim().min(1, 'studentId must not be blank'),
  attachmentId: z.string().trim().min(1, 'attachmentId must not be blank'),
  submitterGuardianId: z.string().trim().min(1, 'submitterGuardianId must not be blank'),
  status: z.nativeEnum(StudentPhotoSubmissionStatus),
  version: z.number().int().positive('version must be a strictly positive integer'),
  reviewerStaffId: z.string().trim().min(1, 'reviewerStaffId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  reviewedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  rejectionReason: z.string().trim().min(1, 'rejectionReason must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
  updatedAt: zodDate().default(() => new Date()),
}).superRefine((value, ctx) => {
  if (value.status === StudentPhotoSubmissionStatus.Rejected && !value.rejectionReason) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'rejectionReason is required when status is rejected',
      path: ['rejectionReason'],
    })
  }
  if (value.updatedAt.getTime() < value.createdAt.getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'updatedAt must not be before createdAt',
      path: ['updatedAt'],
    })
  }
})

export type StudentPhotoSubmissionData = z.infer<typeof studentPhotoSubmissionSchema>
export type StudentPhotoSubmissionInput = z.input<typeof studentPhotoSubmissionSchema>

export class StudentPhotoSubmission {
  readonly data: StudentPhotoSubmissionData

  constructor(args: StudentPhotoSubmissionInput) {
    this.data = parseDomain(studentPhotoSubmissionSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get studentId() { return this.data.studentId }
  get attachmentId() { return this.data.attachmentId }
  get submitterGuardianId() { return this.data.submitterGuardianId }
  get status() { return this.data.status }
  get version() { return this.data.version }
  get reviewerStaffId() { return this.data.reviewerStaffId }
  get reviewedAt() { return this.data.reviewedAt }
  get rejectionReason() { return this.data.rejectionReason }
  get createdAt() { return this.data.createdAt }
  get updatedAt() { return this.data.updatedAt }

  get isPending() {
    return this.status === StudentPhotoSubmissionStatus.Pending
  }

  copyWith(changes: Partial<StudentPhotoSubmissionInput>): StudentPhotoSubmission {
    return new StudentPhotoSubmission({
      id: this.id,
      schoolId: this.schoolId,
      studentId: this.studentId,
      attachmentId: this.attachmentId,
      submitterGuardianId: this.submitterGuardianId,
      status: this.status,
      version: this.version,
      reviewerStaffId: this.reviewerStaffId,
      reviewedAt: this.reviewedAt,
      rejectionReason: this.rejectionReason,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      ...changes,
    })
  }
}
