import type {
  AttendanceClassDailySeedInput,
  AttendanceLessonSessionSeedInput,
  AttendanceSeedPort,
  AttendanceSeedRecord,
} from './port'
import { demoCiDataset, demoDataset } from '@edaya/fixtures'
import { resolveExpectedCounts } from '@edaya/fixtures/meta/fixture-counts'
import { describe, expect, test } from 'bun:test'
import { seedDevAttendance } from './workflow'

function createAttendanceSeedPortStub() {
  const lessonSessions: AttendanceLessonSessionSeedInput[] = []
  const records: AttendanceSeedRecord[] = []
  const dailyDays: AttendanceClassDailySeedInput[] = []
  const pending: Array<{ id: string, fallbackReason: string }> = []
  const port: AttendanceSeedPort = {
    ensureLessonSession: async (input) => {
      lessonSessions.push(input)
      return { lessonSessionId: `${input.scheduleId}:${input.date}` }
    },
    recordAttendance: async (record) => {
      records.push(record)
    },
    recordClassDailyAttendance: async (input) => {
      dailyDays.push(input)
    },
    markJustificationPending: async (id, fallbackReason) => {
      pending.push({ id, fallbackReason })
    },
  }
  return { port, lessonSessions, records, dailyDays, pending }
}

describe('attendance seed port workflow', () => {
  test('seeds lesson sessions and marks configured justifications pending', async () => {
    const attendanceSessions = demoDataset.extensions?.attendanceSessions
    if (!attendanceSessions) {
      throw new Error('demoDataset must include attendanceSessions extension')
    }

    const { port, lessonSessions, records, pending } = createAttendanceSeedPortStub()

    const count = await seedDevAttendance(port, demoDataset)
    const expectedAttendance = resolveExpectedCounts(demoDataset).attendance

    expect(count).toBe(expectedAttendance ?? 0)
    expect(lessonSessions).toHaveLength(attendanceSessions.absenceSessions.length + 1)
    expect(records).toHaveLength(attendanceSessions.absenceSessions.reduce(
      (total, session) => total + session.records.length,
      attendanceSessions.todaySession.records.length,
    ))
    expect(pending.map(record => record.id)).toEqual([...new Set(attendanceSessions.pendingJustificationRecordIds)])
    expect(pending.every(record => record.fallbackReason.length > 0)).toBe(true)
  })

  test('seeds demo-ci daily roll-call days for 6ème 1 and 6ème 2', async () => {
    const dailyAttendanceDays = demoCiDataset.extensions?.dailyAttendanceDays
    if (!dailyAttendanceDays) {
      throw new Error('demoCiDataset must include dailyAttendanceDays extension')
    }

    const { port, dailyDays } = createAttendanceSeedPortStub()
    const count = await seedDevAttendance(port, demoCiDataset)
    const expectedAttendance = resolveExpectedCounts(demoCiDataset).attendance

    expect(dailyDays).toHaveLength(6)
    expect(dailyDays.filter(day => day.classGroupId === 'ci-6a')).toHaveLength(3)
    expect(dailyDays.filter(day => day.classGroupId === 'ci-6b')).toHaveLength(3)
    expect(count).toBe(expectedAttendance ?? 0)
  })
})
