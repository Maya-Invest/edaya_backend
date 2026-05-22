import { requireNonBlank, requireOptionalNonBlank } from '../../validation'

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
  classroomId: string
  periodDefinitionId: string
  dayOfWeek: DayOfWeek
  moduleId?: string | null
  resourceId?: string | null
  createdAt?: Date
}

/**
 * Maps a classroom's weekly recurring schedule by assigning a module
 * and optional resource (room/lab) to a specific day + period slot.
 * Sessions can be generated from timetable slots, skipping non-school days.
 */
export class TimetableSlot {
  readonly id: string
  readonly classroomId: string
  readonly periodDefinitionId: string
  readonly dayOfWeek: DayOfWeek
  readonly moduleId?: string
  readonly resourceId?: string
  readonly createdAt: Date

  constructor({
    id,
    classroomId,
    periodDefinitionId,
    dayOfWeek,
    moduleId,
    resourceId,
    createdAt,
  }: TimetableSlotArgs) {
    this.id = requireNonBlank(id, 'id')
    this.classroomId = requireNonBlank(classroomId, 'classroomId')
    this.periodDefinitionId = requireNonBlank(periodDefinitionId, 'periodDefinitionId')
    this.dayOfWeek = dayOfWeek
    this.moduleId = requireOptionalNonBlank(moduleId, 'moduleId')
    this.resourceId = requireOptionalNonBlank(resourceId, 'resourceId')
    this.createdAt = createdAt ?? new Date()
  }
}
