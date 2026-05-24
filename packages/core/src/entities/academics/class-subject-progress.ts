import { ClassSubjectMatterStatus } from '$lib/core/entities/academics/class-subject-matter'
import { requireNonBlank, requireNonNegativeNumber, requireOptionalNonBlank, requireValidDate } from '$lib/core/utils/validation'

export interface ClassSubjectProgressArgs {
  id: string
  classSubjectMatterId: string
  sessionId: string
  completedPercentage: number
  recordedByStaffId?: string | null
  notes?: string | null
  recordedAt?: Date
}

/**
 * Captures a class subject matter's cumulative progress at the end of a session.
 * Multiple records provide the daily progression history while ClassSubjectMatter
 * retains the current aggregate state.
 */
export class ClassSubjectProgress {
  readonly id: string
  readonly classSubjectMatterId: string
  readonly sessionId: string
  readonly completedPercentage: number
  readonly recordedByStaffId?: string
  readonly notes?: string
  readonly recordedAt: Date

  constructor({
    id,
    classSubjectMatterId,
    sessionId,
    completedPercentage,
    recordedByStaffId,
    notes,
    recordedAt,
  }: ClassSubjectProgressArgs) {
    this.id = requireNonBlank(id, 'id')
    this.classSubjectMatterId = requireNonBlank(classSubjectMatterId, 'classSubjectMatterId')
    this.sessionId = requireNonBlank(sessionId, 'sessionId')
    this.completedPercentage = requireNonNegativeNumber(completedPercentage, 'completedPercentage')
    this.recordedByStaffId = requireOptionalNonBlank(recordedByStaffId, 'recordedByStaffId')
    this.notes = requireOptionalNonBlank(notes, 'notes')
    this.recordedAt = recordedAt ? requireValidDate(recordedAt, 'recordedAt') : new Date()

    if (this.completedPercentage > 100) {
      throw new Error('completedPercentage must be between 0 and 100')
    }
  }

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
