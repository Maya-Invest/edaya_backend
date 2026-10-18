import {
  AcademicYear,
  CalendarEvent,
  CalendarEventKind,
  CalendarEventScopeKind,
  ClassGroup,
  ClassSubject,
  DayOfWeek,
  GradeLevel,
  LessonSession,
  PeriodDefinition,
  Subject,
  SubjectCategory,
  SubjectColor,
  Teacher,
  TeacherAssignment,
  TeacherAssignmentKind,
  TeacherUnavailability,
  TeacherUnavailabilityRecurrence,
  TimetableGenerationMode,
} from '@edaya/core'
import { createTestApp } from './create-test-app'

export async function createTimetableBenchmarkFixture(classCount: number, weeks: number) {
  const fixture = await createTestApp()
  const repositories = fixture.schoolRepositories
  const startDate = new Date('2026-09-07T00:00:00Z')
  const endDate = new Date(startDate.getTime() + (weeks * 7 - 1) * 86_400_000)
  await repositories.academicYears.save(new AcademicYear({ id: 'year', schoolId: 'school', name: 'Benchmark year', startDate, endDate, status: 'published' }))
  await repositories.gradeLevels.save(new GradeLevel({ id: 'grade', schoolId: 'school', name: 'Grade 6', label: 'G6', order: 1 }))
  const groups = Array.from({ length: classCount }, (_, index) => new ClassGroup({ id: `class-${index}`, schoolId: 'school', academicYearId: 'year', gradeLevelId: 'grade', name: `Class ${String(index).padStart(2, '0')}` }))
  await repositories.classGroups.batchSave(groups)
  const subjects = Array.from({ length: 4 }, (_, index) => new Subject({ gradeLevelId: 'grade', academicYearId: 'year', id: `subject-${index}`, schoolId: 'school', name: `Subject ${index}`, category: SubjectCategory.Scientific, color: SubjectColor.Mint }))
  await repositories.subjects.batchSave(subjects)
  const classSubjects = groups.flatMap(group => subjects.map((subject, index) => new ClassSubject({ id: `${group.id}-${subject.id}`, classGroupId: group.id, subjectId: subject.id, periodsPerWeek: 2, minPeriodSpan: 1, maxPeriodSpan: index === 0 ? 2 : 1 })))
  await repositories.classSubjects.batchSave(classSubjects)
  const assignments = groups.flatMap((group, index) => subjects.map((subject, subjectIndex) => new TeacherAssignment({ id: `${group.id}-assignment-${subjectIndex}`, teacherId: subjectIndex < 2 ? `shared-${Math.floor(index / 3)}-${subjectIndex}` : `${group.id}-teacher-${subjectIndex}`, academicYearId: 'year', kind: TeacherAssignmentKind.Subject, classSubjectId: `${group.id}-${subject.id}` })))
  const teacherIds = [...new Set(assignments.map(assignment => assignment.teacherId))]
  await repositories.teachers.batchSave(teacherIds.map(id => new Teacher({ id, schoolId: 'school', firstName: 'Benchmark', lastName: id })))
  await repositories.teacherAssignments.batchSave(assignments)
  const weekdays = [DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday, DayOfWeek.Friday]
  const periods = weekdays.flatMap(dayOfWeek => Array.from({ length: 6 }, (_, index) => new PeriodDefinition({ id: `${dayOfWeek}-${index}`, schoolId: 'school', academicYearId: 'year', label: `Period ${index}`, dayOfWeek, order: index + 1, startTime: `${String(8 + index).padStart(2, '0')}:00`, endTime: `${String(9 + index).padStart(2, '0')}:00`, isTeachingSlot: true })))
  await repositories.periodDefinitions.batchSave(periods)
  await repositories.teacherUnavailabilities.batchSave(teacherIds.filter(id => id.startsWith('shared-')).map(id => new TeacherUnavailability({ id: `unavailable-${id}`, academicYearId: 'year', teacherId: id, recurrence: TeacherUnavailabilityRecurrence.Weekly, dayOfWeek: DayOfWeek.Monday, startTime: '08:00', endTime: '09:00', effectiveFrom: startDate, effectiveUntil: endDate, isActive: true })))
  const closure = new Date(startDate.getTime() + 9 * 86_400_000)
  if (weeks > 1) {
    await repositories.calendarEvents.save(new CalendarEvent({ id: 'closure', schoolId: 'school', academicYearId: 'year', title: 'Class closure', startDate: closure, endDate: closure, kind: CalendarEventKind.Holiday, isNonSchoolDay: true, scopeKind: CalendarEventScopeKind.ClassGroup, scopeId: groups[0]!.id }))
  }
  // Existing standalone lessons survive regeneration and occupy shared teachers.
  await repositories.lessonSessions.batchSave(groups.flatMap((group, index) => Array.from({ length: weeks }, (_, week) => new LessonSession({ id: `${group.id}-existing-${week}`, schoolId: 'school', classGroupId: group.id, classSubjectId: `${group.id}-subject-0`, displayLabel: 'Existing lesson', timetableTeacherIds: [`shared-${Math.floor(index / 3)}-0`], startsAt: new Date(startDate.getTime() + (week * 7 * 24 + 13) * 3_600_000), endsAt: new Date(startDate.getTime() + (week * 7 * 24 + 14) * 3_600_000) }))))
  return { ...fixture, groups, input: { academicYearId: 'year', startDate, endDate, options: { generationMode: TimetableGenerationMode.Weekly, enforceWorkloadFulfillment: false, minDayGapSameSubject: 1 } } }
}
