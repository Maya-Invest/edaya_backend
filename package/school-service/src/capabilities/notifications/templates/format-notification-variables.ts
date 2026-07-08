import type { AnnouncementPriority } from '@edaya/core'
import { AnnouncementPriority as AnnouncementPriorityEnum, AttendanceStatus, IncidentKind } from '@edaya/core'

const NOTIFICATION_LOCALE = 'fr-FR'

export function formatNotificationDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(NOTIFICATION_LOCALE, {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function formatNotificationTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(NOTIFICATION_LOCALE, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatNotificationTimeRange(
  startsAt: Date,
  endsAt: Date,
  timeZone: string,
): string {
  return `${formatNotificationTime(startsAt, timeZone)}–${formatNotificationTime(endsAt, timeZone)}`
}

function sameCalendarDayInTimeZone(a: Date, b: Date, timeZone: string): boolean {
  return formatNotificationDate(a, timeZone) === formatNotificationDate(b, timeZone)
}

export function formatNotificationDateRange(
  startDate: Date,
  endDate: Date,
  timeZone: string,
): string {
  const startLabel = formatNotificationDate(startDate, timeZone)
  if (sameCalendarDayInTimeZone(startDate, endDate, timeZone)) {
    return startLabel
  }
  return `${startLabel} – ${formatNotificationDate(endDate, timeZone)}`
}

export function formatNotificationDueLabel(dueAt: Date, timeZone: string): string {
  const date = formatNotificationDate(dueAt, timeZone)
  const isDateOnly = dueAt.getUTCHours() === 0
    && dueAt.getUTCMinutes() === 0
    && dueAt.getUTCSeconds() === 0
    && dueAt.getUTCMilliseconds() === 0
  if (isDateOnly) {
    return date
  }
  return `${date} at ${formatNotificationTime(dueAt, timeZone)}`
}

export function truncateNotificationText(text: string, maxLength = 160): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxLength) {
    return trimmed
  }

  const slice = trimmed.slice(0, maxLength - 1)
  const lastSpace = slice.lastIndexOf(' ')
  const shortened = lastSpace > maxLength * 0.6 ? slice.slice(0, lastSpace) : slice
  return `${shortened}…`
}

export function labelAttendanceStatus(status: AttendanceStatus): string {
  switch (status) {
    case AttendanceStatus.Absent:
      return 'Absent'
    case AttendanceStatus.Late:
      return 'Late'
    case AttendanceStatus.Present:
      return 'Present'
  }
}

export function labelIncidentKind(kind: IncidentKind): string {
  switch (kind) {
    case IncidentKind.Positive:
      return 'Positive note'
    case IncidentKind.MinorInfraction:
      return 'Minor incident'
    case IncidentKind.MajorInfraction:
      return 'Major incident'
    case IncidentKind.Emergency:
      return 'Emergency'
  }
}

export function labelAnnouncementPriority(priority: AnnouncementPriority): string {
  switch (priority) {
    case AnnouncementPriorityEnum.Urgent:
      return 'Urgent'
    case AnnouncementPriorityEnum.Important:
      return 'Important'
    case AnnouncementPriorityEnum.Normal:
      return ''
  }
}

export function formatPersonName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim()
}

export function formatScoreDisplay(score: number | undefined, maxScore: number): string {
  if (score === undefined) {
    return 'Recorded'
  }
  return `${score}/${maxScore}`
}
