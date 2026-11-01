import type { AcademicYear, Schedule } from '@edaya/core'
import { civilDateKey, DayOfWeek, isSameDate, normalizeDate, OccurrenceStatus } from '@edaya/core'

const dayOfWeekMap: Record<number, DayOfWeek> = {
  0: DayOfWeek.Sunday,
  1: DayOfWeek.Monday,
  2: DayOfWeek.Tuesday,
  3: DayOfWeek.Wednesday,
  4: DayOfWeek.Thursday,
  5: DayOfWeek.Friday,
  6: DayOfWeek.Saturday,
}

interface Occurrence { id: string, startsAt: Date, endsAt: Date, displayLabel: string }
interface PersistedOccurrence { id: string, status: OccurrenceStatus, isResyncEligible: boolean }

/** One existing-occurrence read per schedule; sequential writes retain conflict visibility. */
export async function materializeOccurrences<T extends PersistedOccurrence>(deps: {
  list: () => Promise<T[]>
  save: (entity: T) => Promise<void>
  create: (occurrence: Occurrence) => T
  update: (existing: T, occurrence: Occurrence) => T
  assertNoConflict: (occurrence: Occurrence) => Promise<void>
}, input: { schedule: Schedule, academicYear: AcademicYear, displayLabel: string, nonSchoolDates: ReadonlySet<string>, enforceConflicts: boolean }): Promise<T[]> {
  const { schedule } = input
  const existingById = new Map((await deps.list()).map(row => [row.id, row]))
  const materialized: T[] = []
  let date = normalizeDate(input.academicYear.startDate)
  const until = normalizeDate(input.academicYear.endDate)
  const [startH = 0, startM = 0] = schedule.startTime.split(':').map(Number)
  const [endH = 0, endM = 0] = schedule.endTime.split(':').map(Number)
  while (date <= until) {
    const matches = schedule.isRecurring ? schedule.dayOfWeek === dayOfWeekMap[date.getUTCDay()] : schedule.specificDate && isSameDate(schedule.specificDate, date)
    if (!input.nonSchoolDates.has(civilDateKey(date)) && matches) {
      const id = `${schedule.id}:${date.toISOString().slice(0, 10)}`
      const existing = existingById.get(id)
      if (existing?.status !== OccurrenceStatus.Cancelled) {
        const occurrence = { id, displayLabel: input.displayLabel, startsAt: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), startH, startM)), endsAt: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), endH, endM)) }
        if (input.enforceConflicts)
          await deps.assertNoConflict(occurrence)
        const updated = !existing ? deps.create(occurrence) : existing.isResyncEligible ? deps.update(existing, occurrence) : undefined
        if (updated) {
          await deps.save(updated)
          materialized.push(updated)
        }
      }
    }
    date = new Date(date.getTime() + 86400000)
  }
  return materialized
}
