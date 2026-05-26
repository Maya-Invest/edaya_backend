import { requireNonBlank, requireNonNegativeNumber, requireOptionalNonBlank, requireValidDate } from '../utils'

export enum ClassSubjectMatterStatus {
  NotStarted = 'not_started',
  InProgress = 'in_progress',
  Completed = 'completed',
}

export interface ClassSubjectMatterArgs {
  id: string
  classSubjectId: string
  subjectMatterId: string
  status: ClassSubjectMatterStatus
  completedPercentage: number
  updatedByStaffId?: string | null
  startedAt?: Date | null
  completedAt?: Date | null
  notes?: string | null
  updatedAt?: Date
}

export class ClassSubjectMatter {
  readonly id: string
  readonly classSubjectId: string
  readonly subjectMatterId: string
  readonly status: ClassSubjectMatterStatus
  readonly completedPercentage: number
  readonly updatedByStaffId?: string
  readonly startedAt?: Date
  readonly completedAt?: Date
  readonly notes?: string
  readonly updatedAt: Date

  constructor({
    id,
    classSubjectId,
    subjectMatterId,
    status,
    completedPercentage,
    updatedByStaffId,
    startedAt,
    completedAt,
    notes,
    updatedAt,
  }: ClassSubjectMatterArgs) {
    this.id = requireNonBlank(id, 'id')
    this.classSubjectId = requireNonBlank(classSubjectId, 'classSubjectId')
    this.subjectMatterId = requireNonBlank(subjectMatterId, 'subjectMatterId')
    this.status = status
    this.completedPercentage = requireNonNegativeNumber(completedPercentage, 'completedPercentage')
    this.updatedByStaffId = requireOptionalNonBlank(updatedByStaffId, 'updatedByStaffId')
    this.startedAt = startedAt ? requireValidDate(startedAt, 'startedAt') : undefined
    this.completedAt = completedAt ? requireValidDate(completedAt, 'completedAt') : undefined
    this.notes = requireOptionalNonBlank(notes, 'notes')
    this.updatedAt = updatedAt ?? new Date()

    if (this.completedPercentage < 0 || this.completedPercentage > 100) {
      throw new Error('completedPercentage must be between 0 and 100')
    }
  }
}
