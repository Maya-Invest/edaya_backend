import type {
  AttendanceSeedPort,
  AttendanceSeedRecord,
  AttendanceSessionSeedRecord,
} from './port'
import {
  countSeedAttendanceRecords,
  SEED_ABSENCE_RECORDS,
  SEED_PENDING_JUSTIFICATION_RECORD_IDS,
} from '@edaya/dev-fixtures'
import { describe, expect, test } from 'bun:test'
import { seedDevAttendance } from './workflow'

describe('attendance seed port workflow', () => {
  test('seeds attendance sessions and marks configured justifications pending', async () => {
    const sessions: AttendanceSessionSeedRecord[] = []
    const records: AttendanceSeedRecord[] = []
    const pending: Array<{ id: string, fallbackReason: string }> = []
    const port: AttendanceSeedPort = {
      createSession: async (record) => {
        sessions.push(record)
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
    expect(sessions).toHaveLength(SEED_ABSENCE_RECORDS.length + 1)
    expect(records).toHaveLength(countSeedAttendanceRecords())
    expect(pending.map(record => record.id)).toEqual([...new Set(SEED_PENDING_JUSTIFICATION_RECORD_IDS)])
    expect(pending.every(record => record.fallbackReason.length > 0)).toBe(true)
  })
})
