import { AttendanceStatus, ClassGroup, GuardianStudentLink, LessonSession, RecordingNotificationGateway, School, Student, withShortName } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { ATTENDANCE_RECORDED_EVENT_KEY } from '../../src/capabilities/notifications'
import { createSchedulingContext } from '../services/workflows/scheduling-workflow-context'

describe('enriched attendance notifications', () => {
  test('renders student, session, and class context from current school records', async () => {
    const gateway = new RecordingNotificationGateway()
    const { service, repositories } = await createSchedulingContext({ notificationGateway: gateway })
    const school = (await repositories.schools.findById('sch1'))!
    await repositories.schools.save(new School(withShortName({ ...school.data, timeZone: 'Africa/Douala' })))
    const student = (await repositories.students.findById('stu1'))!
    await repositories.students.save(new Student({ ...student.data, firstName: 'Léa', lastName: 'Martin' }))
    const group = (await repositories.classGroups.findById('cg_daily'))!
    await repositories.classGroups.save(new ClassGroup(withShortName({ ...group.data, name: '6ème A' })))
    const session = (await repositories.lessonSessions.findById('ses1'))!
    await repositories.lessonSessions.save(new LessonSession({ ...session.data, timetableTeacherIds: [...session.timetableTeacherIds], displayLabel: 'Mathematics' }))
    await service.schedulingWorkflow.recordAttendance({ id: 'att1', studentId: 'stu1', lessonSessionId: 'ses1', status: AttendanceStatus.Absent })
    expect(gateway.enqueued).toHaveLength(1)
    expect(gateway.enqueued[0]).toMatchObject({ eventKey: ATTENDANCE_RECORDED_EVENT_KEY, title: 'Léa Martin — Absent' })
    expect(gateway.enqueued[0]?.body).toContain('Mathematics')
    expect(gateway.enqueued[0]?.body).toContain('6ème A')
  })

  test('reads a changed attendance opt-out for the next event', async () => {
    const gateway = new RecordingNotificationGateway()
    const { service, repositories } = await createSchedulingContext({ notificationGateway: gateway })
    await service.schedulingWorkflow.recordAttendance({ id: 'att1', studentId: 'stu1', lessonSessionId: 'ses1', status: AttendanceStatus.Absent })
    expect(gateway.enqueued).toHaveLength(1)
    const link = (await repositories.guardianLinks.findById('link'))!
    await repositories.guardianLinks.save(new GuardianStudentLink({ ...link.data, receivesAttendanceAlerts: false }))
    await service.schedulingWorkflow.recordAttendance({ id: 'att1', studentId: 'stu1', lessonSessionId: 'ses1', status: AttendanceStatus.Late })
    expect(gateway.enqueued).toHaveLength(1)
    expect(await repositories.messageDeliveries.count()).toBe(1)
  })
})
