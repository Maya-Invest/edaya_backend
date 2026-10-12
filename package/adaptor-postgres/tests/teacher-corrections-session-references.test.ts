import { PGlite } from '@electric-sql/pglite'
import { expect, test } from 'bun:test'
import { drizzle } from 'drizzle-orm/pglite'
import { PostgresTeacherCorrections } from '../src/stores/teacher-corrections-store'

test('protects logbook history and attendance drafts by exact school and session reference', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      CREATE TABLE teacher_workflow_states (school_id text, workflow text, target_id text);
      CREATE TABLE teacher_corrections (school_id text, workflow text, target_id text);
      INSERT INTO teacher_workflow_states VALUES
        ('school', 'logbook', 'validated'),
        ('school', 'attendance', 'lesson:draft'),
        ('school', 'attendance', 'daily:unrelated'),
        ('other', 'logbook', 'foreign');
      INSERT INTO teacher_corrections VALUES
        ('school', 'logbook', 'history-only'),
        ('other', 'logbook', 'foreign-history'),
        ('school', 'attendance', 'unrelated');
    `)
    const store = new PostgresTeacherCorrections(drizzle(db))
    expect((await store.referencedLessonSessionIds('school', ['validated', 'draft', 'history-only', 'foreign', 'foreign-history', 'unrelated'])).sort()).toEqual(['draft', 'history-only', 'validated'])
    expect(await store.referencedLessonSessionIds('school', [])).toEqual([])
    expect(await store.referencedLessonSessionIds('school', ['vali', 'draft-other'])).toEqual([])
  }
  finally { await db.close() }
}, 30000)
