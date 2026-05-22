import { requireNonBlank, requireOptionalNonBlank, requirePositiveNumber, requireValidDate } from '../../utils/validation'

export enum ModuleProgressStatus {
  NotStarted = 'not_started',
  InProgress = 'in_progress',
  Completed = 'completed',
}

export interface ModuleProgressArgs {
  id: string
  classroomId: string
  moduleId: string
  subjectMatterId: string
  status: ModuleProgressStatus
  completedPercentage: number
  updatedByStaffId?: string | null
  startedAt?: Date | null
  completedAt?: Date | null
  notes?: string | null
  updatedAt?: Date
}

export class ModuleProgress {
  readonly id: string
  readonly classroomId: string
  readonly moduleId: string
  readonly subjectMatterId: string
  readonly status: ModuleProgressStatus
  readonly completedPercentage: number
  readonly updatedByStaffId?: string
  readonly startedAt?: Date
  readonly completedAt?: Date
  readonly notes?: string
  readonly updatedAt: Date

  constructor({
    id,
    classroomId,
    moduleId,
    subjectMatterId,
    status,
    completedPercentage,
    updatedByStaffId,
    startedAt,
    completedAt,
    notes,
    updatedAt,
  }: ModuleProgressArgs) {
    this.id = requireNonBlank(id, 'id')
    this.classroomId = requireNonBlank(classroomId, 'classroomId')
    this.moduleId = requireNonBlank(moduleId, 'moduleId')
    this.subjectMatterId = requireNonBlank(subjectMatterId, 'subjectMatterId')
    this.status = status
    this.completedPercentage = requirePositiveNumber(completedPercentage, 'completedPercentage')
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
