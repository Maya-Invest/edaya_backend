import type {
  AttendanceDailySeedRecord,
  AttendanceLessonSessionSeedInput,
  AttendanceSeedPort,
  AttendanceSeedRecord,
} from './port'
import { demoCiDataset, demoDataset } from '@edaya/fixtures'
import { resolveExpectedCounts } from '@edaya/fixtures/meta/fixture-counts'
import { describe, expect, test } from 'bun:test'
import { seedDevAttendance } from './workflow'

describe('attendance seed port workflow', () => {
  test('seeds lesson sessions and marks configured justifications pending', async () => {
    const attendanceSessions = demoDataset.extensions?.attendanceSessions
    if (!attendanceSessions) {
      throw new Error('demoDataset must include attendanceSessions extension')
    }

    const lessonSessions: AttendanceLessonSessionSeedInput[] = []
    const records: AttendanceSeedRecord[] = []
    const dailyRecords: AttendanceDailySeedRecord[] = []
    const pending: Array<{ id: string, fallbackReason: string }> = []
    const port: AttendanceSeedPort = {
      ensureLessonSession: async (input) => {
        lessonSessions.push(input)
        return { lessonSessionId: `${input.scheduleId}:${input.date}` }
      },
      recordAttendance: async (record) => {
        records.push(record)
      },
      recordDailyAttendance: async (record) => {
        dailyRecords.push(record)
      },
      markJustificationPending: async (id, fallbackReason) => {
        pending.push({ id, fallbackReason })
      },
    }

    const count = await seedDevAttendance(port, demoDataset)
    const expectedAttendance = resolveExpectedCounts(demoDataset).attendance

    expect(count).toBe(expectedAttendance ?? 0)
    expect(lessonSessions).toHaveLength(attendanceSessions.absenceSessions.length + 1)
    expect(records).toHaveLength(expectedAttendance ?? 0)
    expect(dailyRecords).toHaveLength(0)
    expect(pending.map(record => record.id)).toEqual([...new Set(attendanceSessions.pendingJustificationRecordIds)])
    expect(pending.every(record => record.fallbackReason.length > 0)).toBe(true)
  })

  test('seeds daily roll-call days for demo-ci daily-mode classes', async () => {
    const dailyDays = demoCiDataset.extensions?.dailyAttendanceDays
    if (!dailyDays?.length) {
      throw new Error('demoCiDataset must include dailyAttendanceDays extension')
    }

    const dailyRecords: AttendanceDailySeedRecord[] = []
    const port: AttendanceSeedPort = {
      ensureLessonSession: async input => ({ lessonSessionId: `${input.scheduleId}:${input.date}` }),
      recordAttendance: async () => {},
      recordDailyAttendance: async (record) => {
        dailyRecords.push(record)
      },
      markJustificationPending: async () => {},
    }

    await seedDevAttendance(port, demoCiDataset)

    const expectedDaily = dailyDays.reduce((total, day) => total + day.records.length, 0)
    expect(dailyRecords).toHaveLength(expectedDaily)
    expect(dailyRecords.every(record => record.classGroupId === 'ci-6a' || record.classGroupId === 'ci-6b')).toBe(true)
  })
})
