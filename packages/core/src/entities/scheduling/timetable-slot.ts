import { requireNonBlank, requireOptionalNonBlank } from '../../utils/validation'

export enum DayOfWeek {
  Monday = 'monday',
  Tuesday = 'tuesday',
  Wednesday = 'wednesday',
  Thursday = 'thursday',
  Friday = 'friday',
  Saturday = 'saturday',
  Sunday = 'sunday',
}

export interface TimetableSlotArgs {
  id: string
  classGroupId: string
  periodDefinitionId: string
  dayOfWeek: DayOfWeek
  classSubjectId?: string | null
  resourceId?: string | null
  createdAt?: Date
}

/**
 * Maps a classGroup's weekly recurring schedule by assigning a module
 * and optional resource (room/lab) to a specific day + period slot.
 * Sessions can be generated from timetable slots, skipping non-school days.
 */
export class TimetableSlot {
  readonly id: string
  readonly classGroupId: string
  readonly periodDefinitionId: string
  readonly dayOfWeek: DayOfWeek
  readonly classSubjectId?: string
  readonly resourceId?: string
  readonly createdAt: Date

  constructor({
    id,
    classGroupId,
    periodDefinitionId,
    dayOfWeek,
    classSubjectId,
    resourceId,
    createdAt,
  }: TimetableSlotArgs) {
    this.id = requireNonBlank(id, 'id')
    this.classGroupId = requireNonBlank(classGroupId, 'classGroupId')
    this.periodDefinitionId = requireNonBlank(periodDefinitionId, 'periodDefinitionId')
    this.dayOfWeek = dayOfWeek
    this.classSubjectId = requireOptionalNonBlank(classSubjectId, 'classSubjectId')
    this.resourceId = requireOptionalNonBlank(resourceId, 'resourceId')
    this.createdAt = createdAt ?? new Date()
  }
}
