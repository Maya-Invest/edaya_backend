import { AttendanceMode, ClassGroup } from '@edaya/core'
import { describe, expect, test } from 'bun:test'

describe('ClassGroup entity', () => {
  const baseArgs = {
    id: 'cg1',
    schoolId: 'sch1',
    academicYearId: 'y1',
    gradeLevelId: 'gl1',
    name: '10A',
  }

  test('instantiates successfully with valid inputs', () => {
    const group = new ClassGroup({
      ...baseArgs,
      capacity: 30,
      attendanceMode: AttendanceMode.Daily,
      homeroomStaffId: 'staff1',
    })

    expect(group.id).toBe('cg1')
    expect(group.capacity).toBe(30)
    expect(group.attendanceMode).toBe(AttendanceMode.Daily)
    expect(group.homeroomStaffId).toBe('staff1')
  })

  test('uses default attendance mode when omitted', () => {
    const group = new ClassGroup(baseArgs)
    expect(group.attendanceMode).toBe(AttendanceMode.Session)
  })

  test('throws error if capacity is zero or negative', () => {
    expect(() => {
      new ClassGroup({ ...baseArgs, capacity: 0 })
    }).toThrow('capacity must be a strictly positive integer')

    expect(() => {
      new ClassGroup({ ...baseArgs, capacity: -1 })
    }).toThrow('capacity must be a strictly positive integer')
  })

  test('copies successfully using copyWith', () => {
    const group = new ClassGroup(baseArgs)
    const updated = group.copyWith({
      name: '10B',
      capacity: 25,
      attendanceMode: AttendanceMode.Daily,
    })

    expect(updated.id).toBe('cg1')
    expect(updated.name).toBe('10B')
    expect(updated.capacity).toBe(25)
    expect(updated.attendanceMode).toBe(AttendanceMode.Daily)
  })
})
