import { z } from 'zod'

import { parseDomain, zodDate } from '../shared/utils'

import { ClassSubjectMatterStatus } from './class-subject-matter'

export const classSubjectProgressSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  classSubjectMatterId: z.string().trim().min(1, 'classSubjectMatterId must not be blank'),
  lessonSessionId: z.string().trim().min(1, 'lessonSessionId must not be blank'),
  /** Null identifies a preserved historical zero-percent reference. */
  completed: z.boolean().nullable(),
  legacyPercentage: z.number().int().min(0).max(100).nullable().optional(),
  recordedByStaffId: z.string().trim().min(1, 'recordedByStaffId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  notes: z.string().trim().min(1, 'notes must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  recordedAt: zodDate().default(() => new Date()),
})

export type ClassSubjectProgressData = z.infer<typeof classSubjectProgressSchema>
export type ClassSubjectProgressInput = z.input<typeof classSubjectProgressSchema>

export const classSubjectProgressCreateSchema = classSubjectProgressSchema.omit({ recordedAt: true, legacyPercentage: true })
export const classSubjectProgressUpdateSchema = classSubjectProgressSchema.partial().required({ id: true })

/**
 * Per–class-subject-matter progress snapshot for a lesson occurrence.
 */
export class ClassSubjectProgress {
  readonly data: ClassSubjectProgressData

  constructor(args: ClassSubjectProgressInput) {
    this.data = parseDomain(classSubjectProgressSchema, args)
  }

  get id() { return this.data.id }
  get classSubjectMatterId() { return this.data.classSubjectMatterId }
  get lessonSessionId() { return this.data.lessonSessionId }
  get completed() { return this.data.completed }
  get recordedByStaffId() { return this.data.recordedByStaffId }
  get notes() { return this.data.notes }
  get recordedAt() { return this.data.recordedAt }

  get status(): ClassSubjectMatterStatus {
    if (this.completed === null) {
      return ClassSubjectMatterStatus.NotStarted
    }
    if (this.completed) {
      return ClassSubjectMatterStatus.Completed
    }
    return ClassSubjectMatterStatus.InProgress
  }
}
