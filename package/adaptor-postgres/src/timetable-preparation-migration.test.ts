import { PGlite } from '@electric-sql/pglite'
import { describe, expect, test } from 'bun:test'

describe('timetable preparation migration', () => {
  test('retains Monday ids, clones Tuesday-Friday, and preserves existing sessions', async () => {
    const db = new PGlite()
    try {
      await db.exec(`
        CREATE TABLE period_definitions (
          id text PRIMARY KEY,
          school_id text NOT NULL,
          academic_year_id text NOT NULL,
          label text NOT NULL,
          order_val integer NOT NULL,
          start_time text NOT NULL,
          end_time text NOT NULL,
          is_break boolean DEFAULT false NOT NULL,
          created_at timestamp NOT NULL
        );
        CREATE TABLE grade_level_subjects (id text PRIMARY KEY);
        CREATE TABLE class_subjects (id text PRIMARY KEY);
        CREATE TABLE lesson_sessions (id text PRIMARY KEY, schedule_id text NOT NULL);
        CREATE TABLE schools (id text PRIMARY KEY);
        INSERT INTO period_definitions VALUES (
          'period-1', 'school-1', 'year-1', 'Period 1', 1, '08:00', '09:00', false, '2026-01-01'
        );
        INSERT INTO lesson_sessions VALUES ('lesson-1', 'schedule-1');
        INSERT INTO schools VALUES ('school-1');
      `)

      const migration = await Bun.file(new URL('../drizzle/0043_timetable_generation_preparation.sql', import.meta.url)).text()
      await db.exec(migration)

      const periods = await db.query<{ id: string, day_of_week: string, is_teaching_slot: boolean }>(
        'SELECT id, day_of_week, is_teaching_slot FROM period_definitions ORDER BY day_of_week',
      )
      expect(periods.rows).toHaveLength(5)
      expect(periods.rows).toContainEqual({ id: 'period-1', day_of_week: 'monday', is_teaching_slot: true })
      expect(periods.rows).toContainEqual({ id: 'period-1__friday', day_of_week: 'friday', is_teaching_slot: true })

      const sessions = await db.query<{ id: string, schedule_id: string | null, timetable_generated: string | null }>(
        'SELECT id, schedule_id, timetable_generated FROM lesson_sessions',
      )
      expect(sessions.rows).toEqual([{ id: 'lesson-1', schedule_id: 'schedule-1', timetable_generated: null }])
    }
    finally {
      await db.close()
    }
  }, 15_000)
})
