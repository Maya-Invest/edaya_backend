import { z } from 'zod'

import { refineEndsAtAfterStartsAt } from '../../domain/value-objects/date-time-range'

import { normalizeDate, parseDomain, zodDate } from '../shared/utils'
import { marksReviewSchema, marksStatusSchema } from './marks-review'

export enum AssessmentKind {
  Quiz = 'quiz',
  Homework = 'homework',
  Project = 'project',
  Other = 'other',
}

export const assessmentAttachmentSchema = z.object({
  name: z.string().trim().min(1, 'attachment name must not be blank'),
  size: z.string().trim().min(1, 'attachment size must not be blank'),
})

export type AssessmentAttachment = z.infer<typeof assessmentAttachmentSchema>

export const assessmentBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  classGroupId: z.string().trim().min(1, 'classGroupId must not be blank'),
  classSubjectId: z.string().trim().min(1, 'classSubjectId must not be blank'),
  periodId: z.string().trim().min(1, 'periodId must not be blank'),
  title: z.string().trim().min(1, 'title must not be blank'),
  kind: z.nativeEnum(AssessmentKind),
  maxScore: z.number().finite().positive('maxScore must be a finite, strictly positive number'),
  coefficient: z.number().finite().positive('coefficient must be a finite, strictly positive number').default(1),
  description: z.string().trim().min(1, 'description must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  attachments: z.array(assessmentAttachmentSchema).default([]),
  lessonSessionId: z.string().trim().min(1, 'lessonSessionId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  startsAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  endsAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  dueAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  completedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  marksStatus: marksStatusSchema.default('draft'),
  marksRevision: z.number().int().nonnegative().default(0),
  marksReview: marksReviewSchema.default({}),
  createdAt: zodDate().default(() => new Date()),
})

export function buildInClassAssessmentWindow(date: Date): { startsAt: Date, endsAt: Date } {
  const startsAt = normalizeDate(date)
  startsAt.setUTCHours(9, 0, 0, 0)
  const endsAt = new Date(startsAt)
  endsAt.setUTCHours(10, 0, 0, 0)
  return { startsAt, endsAt }
}

function refineAssessment(
  data: {
    kind?: AssessmentKind
    startsAt?: Date
    endsAt?: Date
    dueAt?: Date
    lessonSessionId?: string
  },
  ctx: z.RefinementCtx,
) {
  if (data.startsAt && data.endsAt) {
    refineEndsAtAfterStartsAt({ startsAt: data.startsAt, endsAt: data.endsAt }, ctx)
  }

  if (data.kind === AssessmentKind.Homework) {
    if (!data.dueAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'homework assessments require dueAt',
        path: ['dueAt'],
      })
    }
    if (data.startsAt || data.endsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'homework assessments cannot define startsAt or endsAt',
      })
    }
    return
  }

  if (data.dueAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'dueAt is only valid for homework assessments',
      path: ['dueAt'],
    })
  }

  const hasTimedRange = Boolean(data.startsAt && data.endsAt)
  const hasLessonSession = Boolean(data.lessonSessionId)

  if (!hasTimedRange && !hasLessonSession) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'in-class assessments require startsAt and endsAt or lessonSessionId',
    })
  }

  if ((data.startsAt && !data.endsAt) || (!data.startsAt && data.endsAt)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'startsAt and endsAt must be provided together',
    })
  }
}

export const assessmentSchema = assessmentBaseSchema.superRefine(refineAssessment)

export type AssessmentData = z.infer<typeof assessmentSchema>
export type AssessmentInput = z.input<typeof assessmentSchema>

export const assessmentCreateSchema = assessmentBaseSchema.omit({ createdAt: true }).superRefine(refineAssessment)
export const assessmentUpdateSchema = assessmentBaseSchema.partial().required({ id: true }).superRefine(refineAssessment)

/**
 * Defines a graded activity for a classGroup subject.
 * Assessment results reference an assessment so scoring rules and grading intent stay explicit.
 */
export class Assessment {
  readonly data: AssessmentData

  constructor(args: AssessmentInput) {
    this.data = parseDomain(assessmentSchema, args)
  }

  get id() { return this.data.id }
  get classGroupId() { return this.data.classGroupId }
  get classSubjectId() { return this.data.classSubjectId }
  get periodId() { return this.data.periodId }
  get title() { return this.data.title }
  get kind() { return this.data.kind }
  get maxScore() { return this.data.maxScore }
  get coefficient() { return this.data.coefficient }
  get description() { return this.data.description }
  get attachments() { return this.data.attachments }
  get lessonSessionId() { return this.data.lessonSessionId }
  get startsAt() { return this.data.startsAt }
  get endsAt() { return this.data.endsAt }
  get dueAt() { return this.data.dueAt }
  get completedAt() { return this.data.completedAt }
  get marksStatus() { return this.data.marksStatus }
  get marksRevision() { return this.data.marksRevision }
  get marksReview() { return this.data.marksReview }
  get createdAt() { return this.data.createdAt }

  get isHomework(): boolean {
    return this.kind === AssessmentKind.Homework
  }

  get isInClassTimetableCandidate(): boolean {
    return !this.isHomework && !this.dueAt
  }
}
