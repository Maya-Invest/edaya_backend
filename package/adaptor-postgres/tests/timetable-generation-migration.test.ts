import { PGlite } from '@electric-sql/pglite'
import { expect, test } from 'bun:test'

test('migrates every generated state without changing identities or widening permissions', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      CREATE TABLE lesson_sessions (id text PRIMARY KEY, timetable_generated text, timetable_teacher_ids jsonb);
      INSERT INTO lesson_sessions VALUES ('draft', 'draft', '["teacher"]'), ('published', 'published', '["teacher"]'), ('manual', NULL, '[]');
      CREATE TABLE staff_permission_assignments (id text, permission text);
      CREATE TABLE staff_manual_permission_assignments (id text, permission text);
      CREATE TABLE staff_assignments (id text, permissions jsonb);
      CREATE TABLE staff_permission_profiles (id text, permissions jsonb);
      INSERT INTO staff_permission_assignments VALUES ('publish', 'TIMETABLE_PUBLISH'), ('create', 'TIMETABLE_CREATE');
      INSERT INTO staff_manual_permission_assignments SELECT * FROM staff_permission_assignments;
      INSERT INTO staff_assignments VALUES ('staff', '["TIMETABLE_PUBLISH", "TIMETABLE_CREATE"]');
      INSERT INTO staff_permission_profiles VALUES ('profile', '["TIMETABLE_PUBLISH"]');
    `)
    await db.exec(await Bun.file(new URL('../drizzle/0039_timetable_generation_final.sql', import.meta.url)).text())
    expect((await db.query('SELECT * FROM lesson_sessions ORDER BY id')).rows).toEqual([
      { id: 'draft', timetable_generated: true, timetable_teacher_ids: ['teacher'] },
      { id: 'manual', timetable_generated: false, timetable_teacher_ids: [] },
      { id: 'published', timetable_generated: true, timetable_teacher_ids: ['teacher'] },
    ])
    await db.exec('INSERT INTO lesson_sessions(id) VALUES (\'new\')')
    expect((await db.query('SELECT timetable_generated FROM lesson_sessions WHERE id=\'new\'')).rows).toEqual([{ timetable_generated: false }])
    for (const table of ['staff_permission_assignments', 'staff_manual_permission_assignments'])
      expect((await db.query(`SELECT permission FROM ${table}`)).rows).toEqual([{ permission: 'TIMETABLE_CREATE' }])
    expect((await db.query('SELECT permissions FROM staff_assignments')).rows).toEqual([{ permissions: ['TIMETABLE_CREATE'] }])
    expect((await db.query('SELECT permissions FROM staff_permission_profiles')).rows).toEqual([{ permissions: [] }])
  }
  finally { await db.close() }
}, 45000)
