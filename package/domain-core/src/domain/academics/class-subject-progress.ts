import { z } from 'zod'

import { parseDomain, zodDate } from '../shared/utils'

import { ClassSubjectMatterStatus } from './class-subject-matter'

export const classSubjectProgressSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  classSubjectMatterId: z.string().trim().min(1, 'classSubjectMatterId must not be blank'),
  lessonSessionId: z.string().trim().min(1, 'lessonSessionId must not be blank'),
  completedPercentage: z.preprocess(
    val => val === null ? undefined : val,
    z.number().min(0, 'completedPercentage must be between 0 and 100').max(100, 'completedPercentage must be between 0 and 100'),
  ),
  recordedByStaffId: z.string().trim().min(1, 'recordedByStaffId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  notes: z.string().trim().min(1, 'notes must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  recordedAt: zodDate().default(() => new Date()),
})

export type ClassSubjectProgressData = z.infer<typeof classSubjectProgressSchema>
export type ClassSubjectProgressInput = z.input<typeof classSubjectProgressSchema>

export const classSubjectProgressCreateSchema = classSubjectProgressSchema.omit({ recordedAt: true })
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
  get completedPercentage() { return this.data.completedPercentage }
  get recordedByStaffId() { return this.data.recordedByStaffId }
  get notes() { return this.data.notes }
  get recordedAt() { return this.data.recordedAt }

  get status(): ClassSubjectMatterStatus {
    if (this.completedPercentage === 0) {
      return ClassSubjectMatterStatus.NotStarted
    }
    if (this.completedPercentage === 100) {
      return ClassSubjectMatterStatus.Completed
    }
    return ClassSubjectMatterStatus.InProgress
  }
}
