import { describe, expect, it } from 'bun:test'
import {
  AttendanceJustificationStatus,
  AttendanceRecord,
  AttendanceStatus,
  buildSessionAttendanceSummary,
} from '../../../../src/domain/scheduling/attendance-record'

describe('Attendance record status transitions and validation', () => {
  const baseArgs = {
    id: 'record-1',
    studentId: 'student-1',
    sessionId: 'session-1',
    date: new Date('2026-09-01T08:00:00Z'),
    status: AttendanceStatus.Absent,
    justificationStatus: AttendanceJustificationStatus.None,
  }

  it('successfully creates record with valid args', () => {
    const record = new AttendanceRecord(baseArgs)
    expect(record.id).toBe('record-1')
    expect(record.status).toBe(AttendanceStatus.Absent)
    expect(record.justificationStatus).toBe(AttendanceJustificationStatus.None)
  })

  it('throws error when justifiedByStaffId is provided without justifiedAt', () => {
    expect(() => {
      new AttendanceRecord({
        ...baseArgs,
        justifiedByStaffId: 'staff-1',
      })
    }).toThrow('justifiedAt is required when justifiedByStaffId is provided')
  })

  it('throws error when correctedAt and correctedByStaffId are not provided together', () => {
    expect(() => {
      new AttendanceRecord({
        ...baseArgs,
        correctedAt: new Date(),
      })
    }).toThrow('correctedAt and correctedByStaffId must be provided together')

    expect(() => {
      new AttendanceRecord({
        ...baseArgs,
        correctedByStaffId: 'staff-1',
      })
    }).toThrow('correctedAt and correctedByStaffId must be provided together')
  })

  it('throws error when present attendance carries an absence justification', () => {
    expect(() => {
      new AttendanceRecord({
        ...baseArgs,
        status: AttendanceStatus.Present,
        justificationStatus: AttendanceJustificationStatus.Pending,
      })
    }).toThrow('present attendance must not carry an absence justification')
  })

  it('throws error when reviewed justification lacks reviewing staff or time', () => {
    expect(() => {
      new AttendanceRecord({
        ...baseArgs,
        justificationStatus: AttendanceJustificationStatus.Excused,
      })
    }).toThrow('reviewed justifications must identify the reviewing staff member and time')
  })

  it('successfully creates record with reviewed justification', () => {
    const record = new AttendanceRecord({
      ...baseArgs,
      justificationStatus: AttendanceJustificationStatus.Excused,
      justifiedAt: new Date(),
      justifiedByStaffId: 'staff-1',
    })
    expect(record.justificationStatus).toBe(AttendanceJustificationStatus.Excused)
    expect(record.justifiedByStaffId).toBe('staff-1')
  })

  it('copies successfully using copyWith', () => {
    const record = new AttendanceRecord(baseArgs)
    const updated = record.copyWith({
      status: AttendanceStatus.Late,
      notes: 'Arrived 10 minutes late',
    })
    expect(updated.status).toBe(AttendanceStatus.Late)
    expect(updated.notes).toBe('Arrived 10 minutes late')
    expect(updated.id).toBe(record.id)
  })
})

describe('buildSessionAttendanceSummary', () => {
  it('correctly aggregates attendance records', () => {
    const r1 = new AttendanceRecord({ id: '1', studentId: 's1', sessionId: 'ses1', date: new Date(), status: AttendanceStatus.Present })
    const r2 = new AttendanceRecord({ id: '2', studentId: 's2', sessionId: 'ses1', date: new Date(), status: AttendanceStatus.Absent, justificationStatus: AttendanceJustificationStatus.None })
    const r3 = new AttendanceRecord({ id: '3', studentId: 's3', sessionId: 'ses1', date: new Date(), status: AttendanceStatus.Absent, justificationStatus: AttendanceJustificationStatus.Excused, justifiedAt: new Date(), justifiedByStaffId: 'st1' })
    const r4 = new AttendanceRecord({ id: '4', studentId: 's4', sessionId: 'ses1', date: new Date(), status: AttendanceStatus.Late })

    const summary = buildSessionAttendanceSummary([r1, r2, r3, r4], 5)

    expect(summary.total).toBe(5)
    expect(summary.present).toBe(1)
    expect(summary.absent).toBe(2)
    expect(summary.excusedAbsent).toBe(1)
    expect(summary.late).toBe(1)
  })
})
