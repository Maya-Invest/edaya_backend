import { ClassSubject, DayOfWeek, PeriodDefinition, TimetableGenerationMode } from '@edaya/core'
import { expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { createPostgresSchoolDatabase } from '@/runtime/shared/school-database'
import { fixture } from './support/marks-fixture'

for (const mode of [TimetableGenerationMode.Weekly, TimetableGenerationMode.Free]) {
  for (const work of ['validation', 'attendance-draft', 'attendance-submission'] as const) {
    test(`timetable ${mode} waits for concurrent ${work} and preserves the session and records`, async () => {
      const f = await fixture(`timetable-${mode}-${work}`)
      const subject = (await f.r.classSubjects.findById(f.id('subject')))!
      await f.r.classSubjects.save(new ClassSubject({ ...subject.data, periodsPerWeek: 2 }))
      for (const day of [DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday]) {
        await f.r.periodDefinitions.save(new PeriodDefinition({ id: f.id(`period-${day}`), schoolId: f.id('school'), academicYearId: f.id('year'), dayOfWeek: day, order: 1, label: 'Lesson', startTime: '08:00', endTime: '09:00' }))
      }
      const input = { classGroupId: f.id('class'), academicYearId: f.id('year'), startDate: new Date('2026-09-07'), endDate: new Date('2026-09-11'), options: { generationMode: mode, allowUnassignedTeacherPlacements: true } }
      const generated = await f.editor.timetableGenerationWorkflow.generateClassGroupTimetable(input)
      const lesson = generated.sessions[0]!
      expect(generated.sessions).toHaveLength(2)
      const ready = Promise.withResolvers<void>()
      const release = Promise.withResolvers<void>()
      const base = f.editor.timetableGenerationWorkflow.baseService
      const writing = base.atomicExecution.execute(async () => {
        if (work === 'validation') {
          await f.editor.teacherCorrectionsWorkflow.validateLogbook({ requestId: f.id('validate'), lessonSessionIds: [lesson.id] })
        }
        else {
          await f.editor.teacherCorrectionsWorkflow.attendanceCall(work === 'attendance-draft' ? 'save' : 'submit', { requestId: f.id('attendance'), expectedVersion: 0, anchor: { kind: 'lesson', lessonSessionId: lesson.id }, entries: [{ studentId: f.id('student'), status: 'present' }] })
        }
        ready.resolve()
        await release.promise
      }, { lockKeys: [`academic-state:${f.id('school')}`] })
      void writing.catch(ready.reject)
      await ready.promise
      const regenerating = f.other.timetableGenerationWorkflow.generateClassGroupTimetable(input)
      const observer = await createPostgresSchoolDatabase(process.env.EDAYA_NATIVE_TEST_URL!)
      try {
        let waiting = false
        for (let attempt = 0; attempt < 500 && !waiting; attempt++) {
          const result = await (observer.db as { execute: (query: ReturnType<typeof sql>) => Promise<{ rows: unknown[] }> }).execute(sql`select pid from pg_stat_activity where wait_event = 'advisory'`)
          waiting = result.rows.length > 0
          if (!waiting)
            await Bun.sleep(10)
        }
        expect(waiting).toBe(true)
      }
      finally {
        release.resolve()
        await observer.dispose()
      }
      await writing
      await regenerating
      expect((await f.r.lessonSessions.findById(lesson.id))?.data).toEqual(lesson.data)
      expect(await f.r.lessonSessions.count({ classGroupId: f.id('class') })).toBe(2)
      if (work === 'validation') {
        expect((await f.r.teacherCorrections.state(f.id('school'), 'logbook', lesson.id))?.locked).toBe(true)
      }
      else {
        expect((await f.r.teacherCorrections.state(f.id('school'), 'attendance', `lesson:${lesson.id}`))?.version).toBe(1)
        expect(await f.r.attendance.count({ lessonSessionId: lesson.id })).toBe(work === 'attendance-submission' ? 1 : 0)
      }
    }, 20000)
  }
}
