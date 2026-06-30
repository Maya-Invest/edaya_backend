import { describe, expect, test } from 'bun:test'
import { AttendanceStatus } from '../../src/domains/scheduling/attendance-record'
import { IncidentKind } from '../../src/domains/students/incident'
import {
  formatNotificationDate,
  formatNotificationDateRange,
  formatNotificationDueLabel,
  formatNotificationTime,
  formatNotificationTimeRange,
  formatScoreDisplay,
  labelAttendanceStatus,
  labelIncidentKind,
  truncateNotificationText,
} from '../../src/notifications/templates/format-notification-variables'

describe('format notification variables', () => {
  test('formats dates and times in the school timezone', () => {
    const date = new Date('2026-06-30T07:30:00.000Z')

    expect(formatNotificationDate(date, 'Africa/Douala')).toContain('2026')
    expect(formatNotificationTime(date, 'Africa/Douala')).toMatch(/\d{2}:\d{2}/)
    expect(formatNotificationTimeRange(
      new Date('2026-06-30T07:30:00.000Z'),
      new Date('2026-06-30T08:30:00.000Z'),
      'Africa/Douala',
    )).toContain('–')
  })

  test('formats date ranges and due labels for reminders', () => {
    expect(formatNotificationDateRange(
      new Date('2027-03-01T00:00:00.000Z'),
      new Date('2027-03-03T00:00:00.000Z'),
      'Africa/Douala',
    )).toContain('–')

    expect(formatNotificationDueLabel(
      new Date('2026-06-20T00:00:00.000Z'),
      'Africa/Douala',
    )).toBe('sam. 20 juin 2026')

    expect(formatNotificationDueLabel(
      new Date('2026-06-20T14:30:00.000Z'),
      'Africa/Douala',
    )).toContain('at')
  })

  test('truncates long notification text', () => {
    const text = 'word '.repeat(40)
    const truncated = truncateNotificationText(text, 40)

    expect(truncated.length).toBeLessThanOrEqual(40)
    expect(truncated.endsWith('…')).toBe(true)
  })

  test('labels attendance and incident enums for display', () => {
    expect(labelAttendanceStatus(AttendanceStatus.Absent)).toBe('Absent')
    expect(labelIncidentKind(IncidentKind.Emergency)).toBe('Emergency')
  })

  test('formats score display', () => {
    expect(formatScoreDisplay(14, 20)).toBe('14/20')
    expect(formatScoreDisplay(undefined, 20)).toBe('Recorded')
  })
})
