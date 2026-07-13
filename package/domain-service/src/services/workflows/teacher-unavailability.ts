import type { TeacherUnavailability } from '@edaya/core'
import { DayOfWeek, normalizeDate, TeacherUnavailabilityRecurrence } from '@edaya/core'

export interface ExpandedTeacherUnavailability {
  teacherId: string
  startsAt: Date
  endsAt: Date
  sourceId: string
}

const DAY_BY_UTC_INDEX: Record<number, DayOfWeek> = {
  0: DayOfWeek.Sunday,
  1: DayOfWeek.Monday,
  2: DayOfWeek.Tuesday,
  3: DayOfWeek.Wednesday,
  4: DayOfWeek.Thursday,
  5: DayOfWeek.Friday,
  6: DayOfWeek.Saturday,
}

function nextDate(date: Date): Date {
  const result = normalizeDate(date)
  result.setUTCDate(result.getUTCDate() + 1)
  return result
}

function maxDate(left: Date, right: Date): Date {
  return left > right ? left : right
}

function minDate(left: Date, right: Date): Date {
  return left < right ? left : right
}

function clockTime(date: Date, time: string): Date {
  const [hour = 0, minute = 0] = time.split(':').map(Number)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, minute))
}

export function expandTeacherUnavailability(
  rule: TeacherUnavailability,
  rangeStart: Date,
  rangeEnd: Date,
): ExpandedTeacherUnavailability[] {
  if (!rule.isActive || rangeStart >= rangeEnd) {
    return []
  }
  if (rule.recurrence === TeacherUnavailabilityRecurrence.OneOff) {
    if (rule.startsAt! < rangeEnd && rangeStart < rule.endsAt!) {
      return [{ teacherId: rule.teacherId, startsAt: rule.startsAt!, endsAt: rule.endsAt!, sourceId: rule.id }]
    }
    return []
  }

  const firstDate = maxDate(normalizeDate(rangeStart), normalizeDate(rule.effectiveFrom!))
  const lastExclusive = minDate(rangeEnd, nextDate(rule.effectiveUntil!))
  const expanded: ExpandedTeacherUnavailability[] = []
  for (let date = firstDate; date < lastExclusive; date = nextDate(date)) {
    if (DAY_BY_UTC_INDEX[date.getUTCDay()] !== rule.dayOfWeek) {
      continue
    }
    const startsAt = clockTime(date, rule.startTime!)
    const endsAt = clockTime(date, rule.endTime!)
    if (startsAt < rangeEnd && rangeStart < endsAt) {
      expanded.push({ teacherId: rule.teacherId, startsAt, endsAt, sourceId: rule.id })
    }
  }
  return expanded
}

export function teacherUnavailabilityOverlaps(
  rule: TeacherUnavailability,
  startsAt: Date,
  endsAt: Date,
): boolean {
  return expandTeacherUnavailability(rule, startsAt, endsAt).length > 0
}
