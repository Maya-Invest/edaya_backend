import { PGlite } from '@electric-sql/pglite'
import { describe, expect, test } from 'bun:test'

describe('timetable teacher resolution migration', () => {
  test('adds strict school defaults and empty generated teacher snapshots', async () => {
    const db = new PGlite()
    try {
      await db.exec(`
        CREATE TABLE schools (id text PRIMARY KEY);
        CREATE TABLE lesson_sessions (id text PRIMARY KEY);
        INSERT INTO schools VALUES ('school-1');
        INSERT INTO lesson_sessions VALUES ('lesson-1');
      `)

      const migration = await Bun.file(new URL('./test-fixtures/migrations/timetable-teacher-resolution.sql', import.meta.url)).text()
      await db.exec(migration)

      const schools = await db.query<{
        timetable_allow_unassigned_teacher_placements: boolean
        timetable_use_homeroom_teacher_fallback: boolean
      }>('SELECT timetable_allow_unassigned_teacher_placements, timetable_use_homeroom_teacher_fallback FROM schools')
      expect(schools.rows).toEqual([{
        timetable_allow_unassigned_teacher_placements: false,
        timetable_use_homeroom_teacher_fallback: false,
      }])

      const sessions = await db.query<{ timetable_teacher_ids: string[] }>(
        'SELECT timetable_teacher_ids FROM lesson_sessions',
      )
      expect(sessions.rows).toEqual([{ timetable_teacher_ids: [] }])
    }
    finally {
      await db.close()
    }
  }, 45_000)
})
