import { requireNonBlank, requirePositiveInt } from '$lib/core/validation'

export interface PeriodDefinitionArgs {
  id: string
  schoolId: string
  academicYearId: string
  label: string
  order: number
  startTime: string
  endTime: string
  isBreak?: boolean
  createdAt?: Date
}

const TIME_PATTERN = /^\d{2}:\d{2}$/

/**
 * Defines one slot in the school's daily period grid (e.g., "Period 1: 08:00–08:45").
 * All classrooms share the same grid for a given academic year.
 * Break periods (recess, lunch) are flagged and excluded from teaching slots.
 */
export class PeriodDefinition {
  readonly id: string
  readonly schoolId: string
  readonly academicYearId: string
  readonly label: string
  readonly order: number
  readonly startTime: string
  readonly endTime: string
  readonly isBreak: boolean
  readonly createdAt: Date

  constructor({
    id,
    schoolId,
    academicYearId,
    label,
    order,
    startTime,
    endTime,
    isBreak = false,
    createdAt,
  }: PeriodDefinitionArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.academicYearId = requireNonBlank(academicYearId, 'academicYearId')
    this.label = requireNonBlank(label, 'label')
    this.order = requirePositiveInt(order, 'order')

    if (!TIME_PATTERN.test(startTime)) {
      throw new Error('startTime must be in HH:mm format')
    }
    if (!TIME_PATTERN.test(endTime)) {
      throw new Error('endTime must be in HH:mm format')
    }
    if (startTime >= endTime) {
      throw new Error('endTime must be after startTime')
    }

    this.startTime = startTime
    this.endTime = endTime
    this.isBreak = isBreak
    this.createdAt = createdAt ?? new Date()
  }

  get durationMinutes(): number {
    const partsS = this.startTime.split(':')
    const partsE = this.endTime.split(':')
    const sh = Number(partsS[0])
    const sm = Number(partsS[1])
    const eh = Number(partsE[0])
    const em = Number(partsE[1])
    return eh * 60 + em - (sh * 60 + sm)
  }
}
