import type { AttendanceRecordInput } from '@edaya/core'
import { AttendanceStatus } from '@edaya/core'
import { describe, expect, it } from 'bun:test'
import {
  demoAttendanceRecords,
  demoPendingJustificationRecordIds,
  demoTodayAttendanceSession,
} from '../../../../src/datasets/demo/domains/attendance'

describe('demo attendance', () => {
  it('typed attendance records satisfy AttendanceRecordInput', () => {
    const record = demoAttendanceRecords[0] satisfies AttendanceRecordInput
    expect(record.status).toBe(AttendanceStatus.Absent)
    expect(record.lessonSessionId).toBe('sch-sess-abs-a1:2026-05-12')
  })

  it('today session covers all class 6a narrative students', () => {
    expect(demoTodayAttendanceSession.records).toHaveLength(6)
    expect(demoTodayAttendanceSession.session.date).toBe('2026-06-16')
  })

  it('marks three narrative records as pending justification', () => {
    expect(demoPendingJustificationRecordIds).toHaveLength(3)
  })
})
