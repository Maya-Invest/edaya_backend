import type { Activity, CalendarEvent } from '@edaya/core'
import { createSystemActorMetadata } from '@edaya/authorization'
import { AcademicYear, ActivityEnrollment, ActivityEnrollmentStatus, ClassGroup, GradeLevel, Guardian, GuardianStudentLink, RecordingNotificationGateway, School, Student, StudentClassEnrollment, withShortName } from '@edaya/core'
import { createTestApp } from './create-test-app'

export async function createReminderCronContext(options: { asOf: Date, calendarEvents?: CalendarEvent[], activities?: Activity[] }) {
  const gateway = new RecordingNotificationGateway()
  const actor = createSystemActorMetadata({ systemId: 'processDueNotifications', schoolId: 'school-1', requestId: 'reminder', reason: 'Reminder scan' })
  const fixture = await createTestApp(actor, { notificationGateway: gateway })
  const repositories = fixture.schoolRepositories
  await repositories.schools.save(new School(withShortName({ id: 'school-1', name: 'Edaya School', timeZone: 'Africa/Douala' })))
  await repositories.schools.save(new School(withShortName({ id: 'school-2', name: 'Other School', timeZone: 'UTC' })))
  await repositories.academicYears.save(new AcademicYear(withShortName({ id: 'y1', schoolId: 'school-1', name: '2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), status: 'published' })))
  await repositories.gradeLevels.save(new GradeLevel(withShortName({ id: 'gl1', schoolId: 'school-1', name: '6', shortName: '6', order: 1 })))
  await repositories.classGroups.save(new ClassGroup(withShortName({ id: 'cg1', schoolId: 'school-1', academicYearId: 'y1', gradeLevelId: 'gl1', name: '6A' })))
  await repositories.students.save(new Student({ id: 'stu1', schoolId: 'school-1', firstName: 'A', lastName: 'Student', subjectId: 'subject-stu1' }))
  await repositories.guardians.save(new Guardian({ id: 'gua1', schoolId: 'school-1', firstName: 'A', lastName: 'Guardian', subjectId: 'subject-gua1', email: 'guardian@example.test' }))
  await repositories.guardianLinks.save(new GuardianStudentLink({ id: 'link', schoolId: 'school-1', studentId: 'stu1', guardianId: 'gua1', relationship: 'parent', isPrimary: true, receivesAcademicReports: true }))
  await repositories.enrollments.save(new StudentClassEnrollment({ id: 'enrollment', studentId: 'stu1', classGroupId: 'cg1', academicYearId: 'y1', enrollmentIndex: 1 }))
  for (const event of options.calendarEvents ?? []) await repositories.calendarEvents.save(event)
  for (const activity of options.activities ?? []) {
    await repositories.activities.save(activity)
    if (activity.schoolId === 'school-1')
      await repositories.activityEnrollments.save(new ActivityEnrollment({ id: `enrollment-${activity.id}`, activityId: activity.id, studentId: 'stu1', status: ActivityEnrollmentStatus.Approved }))
  }
  return { context: { asOf: options.asOf, actor, service: fixture.app }, gateway }
}
