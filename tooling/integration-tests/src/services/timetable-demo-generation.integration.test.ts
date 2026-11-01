import { createStaffActorMetadata } from '@edaya/authorization'
import { AcademicDiscipline, AcademicYear, ActivitySession, CalendarEvent, CalendarEventScopeKind, ClassGroup, ClassSubject, GradeLevel, LessonSession, PeriodDefinition, School, Subject, Teacher, TeacherAssignment, TimetableGenerationMode } from '@edaya/core'
import { demoCiDataset } from '@edaya/fixtures'
import { expect, it } from 'bun:test'
import { describeIntegration } from '../support/suite-runner'
import { createTestApp } from '../utils/test-adapter'

// Reproduce the school/range in the reported generation failure, in an isolated database.
describeIntegration('demo school timetable generation', () => {
  it('fills the full academic year around preserved lessons with workload enforcement enabled', async () => {
    const { entities, extensions } = demoCiDataset
    const actor = createStaffActorMetadata({ subjectId: 'admin-user', staffMemberId: 'admin', schoolId: entities.school.id, requestId: 'timetable-demo', authenticatedAt: new Date() })
    const { app, schoolRepositories: repos } = await createTestApp(actor)
    await repos.schools.save(new School({ ...entities.school, ownerSubjectId: actor.subjectId }))
    await repos.academicYears.save(new AcademicYear(entities.academicYear))
    await repos.gradeLevels.batchSave(entities.gradeLevels.map(row => new GradeLevel(row)))
    await repos.classGroups.batchSave(entities.classGroups.map(row => new ClassGroup(row)))
    await repos.academicDisciplines.batchSave((entities.academicDisciplines ?? []).map(row => new AcademicDiscipline(row)))
    await repos.subjects.batchSave(entities.subjects.map(row => new Subject(row)))
    await repos.classSubjects.batchSave(entities.classSubjects.map(row => new ClassSubject(row)))
    await repos.teachers.batchSave(entities.teachers.map(row => new Teacher(row)))
    await repos.teacherAssignments.batchSave(entities.teacherAssignments.map(row => new TeacherAssignment(row)))
    await repos.periodDefinitions.batchSave(entities.periodDefinitions.map(row => new PeriodDefinition(row)))
    const events = extensions.calendarEvents.flatMap((event) => {
      const scopes = event.scope === 'school' ? [undefined] : event.scope
      return scopes.map(scopeId => new CalendarEvent({ ...event, id: `${event.id}:${scopeId ?? 'school'}`, schoolId: entities.school.id, academicYearId: entities.academicYear.id, scopeKind: scopeId ? CalendarEventScopeKind.ClassGroup : CalendarEventScopeKind.School, scopeId }))
    })
    await repos.calendarEvents.batchSave(events)
    const weekday = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const preserved: LessonSession[] = []
    const activities: ActivitySession[] = []
    for (let date = new Date(entities.academicYear.startDate); date <= new Date(entities.academicYear.endDate); date.setUTCDate(date.getUTCDate() + 1)) {
      const key = date.toISOString().slice(0, 10)
      for (const slot of extensions.schedulingSlots) {
        const schedule = slot.schedule
        if (schedule.dayOfWeek !== weekday[date.getUTCDay()] || events.some(event => event.isNonSchoolDay
          && (!event.scopeId || event.scopeId === schedule.classGroupId) && key >= event.startDate.toISOString().slice(0, 10) && key <= event.endDate.toISOString().slice(0, 10))) {
          continue
        }
        const session = { id: `${slot.slotId}:${key}`, schoolId: entities.school.id, classGroupId: schedule.classGroupId, startsAt: new Date(`${key}T${schedule.startTime}:00Z`), endsAt: new Date(`${key}T${schedule.endTime}:00Z`), displayLabel: schedule.title }
        if ('classSubjectId' in schedule) {
          preserved.push(new LessonSession({ ...session, classSubjectId: schedule.classSubjectId }))
        }
        else {
          activities.push(new ActivitySession({ ...session, scheduleId: schedule.id, activityId: schedule.activityId }))
        }
      }
    }
    expect(preserved.length).toBeGreaterThan(100)
    await repos.activitySessions.batchSave(activities)
    await repos.lessonSessions.batchSave(preserved)
    const input = { academicYearId: entities.academicYear.id, startDate: new Date(entities.academicYear.startDate), endDate: new Date(entities.academicYear.endDate), options: { generationMode: TimetableGenerationMode.Weekly, enforceWorkloadFulfillment: true } }
    const result = await app.timetableGenerationWorkflow.generateSchoolTimetable(input)
    expect(result.classGroups).toHaveLength(5)
    expect(result.classGroups.flatMap(group => group.unmetWorkloads)).toEqual([])
    expect(await repos.lessonSessions.findByIds(preserved.map(row => row.id))).toHaveLength(preserved.length)
    const firstCount = (await repos.lessonSessions.list()).length
    const again = await app.timetableGenerationWorkflow.generateSchoolTimetable(input)
    expect(again.classGroups.flatMap(group => group.unmetWorkloads)).toEqual([])
    expect((await repos.lessonSessions.list()).length).toBe(firstCount)
  }, 180_000)
})
