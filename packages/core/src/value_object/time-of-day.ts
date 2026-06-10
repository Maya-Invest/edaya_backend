import { z } from 'zod'

export const TIME_OF_DAY_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/

export const timeOfDaySchema = z.string().regex(TIME_OF_DAY_REGEX, 'must be a valid time in HH:mm format')

export type TimeOfDay = z.infer<typeof timeOfDaySchema>

/** Field-specific message variant for entity schemas (e.g. startTime / endTime). */
export function zodTimeOfDay(field: string) {
  return z.string().regex(TIME_OF_DAY_REGEX, `${field} must be a valid time in HH:mm format`)
}

export function timeOfDayToMinutes(value: string): number {
  const [hours = 0, minutes = 0] = value.split(':').map(Number)
  return hours * 60 + minutes
}
