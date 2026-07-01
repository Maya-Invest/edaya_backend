import type {
  AttendanceLessonSessionSeedInput,
  AttendanceSeedPort,
  AttendanceSeedRecord,
} from './port'
import {
  countSeedAttendanceRecords,
  SEED_ABSENCE_RECORDS,
  SEED_PENDING_JUSTIFICATION_RECORD_IDS,
} from '@edaya/fixtures'
import { describe, expect, test } from 'bun:test'
import { seedDevAttendance } from './workflow'

describe('attendance seed port workflow', () => {
  test('seeds lesson sessions and marks configured justifications pending', async () => {
    const lessonSessions: AttendanceLessonSessionSeedInput[] = []
    const records: AttendanceSeedRecord[] = []
    const pending: Array<{ id: string, fallbackReason: string }> = []
    const port: AttendanceSeedPort = {
      ensureLessonSession: async (input) => {
        lessonSessions.push(input)
        return { lessonSessionId: `${input.scheduleId}:${input.date}` }
      },
      recordAttendance: async (record) => {
        records.push(record)
      },
      markJustificationPending: async (id, fallbackReason) => {
        pending.push({ id, fallbackReason })
      },
    }

    const count = await seedDevAttendance(port)

    expect(count).toBe(countSeedAttendanceRecords())
    expect(lessonSessions).toHaveLength(SEED_ABSENCE_RECORDS.length + 1)
    expect(records).toHaveLength(countSeedAttendanceRecords())
    expect(pending.map(record => record.id)).toEqual([...new Set(SEED_PENDING_JUSTIFICATION_RECORD_IDS)])
    expect(pending.every(record => record.fallbackReason.length > 0)).toBe(true)
  })
})
