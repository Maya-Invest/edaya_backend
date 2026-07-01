import type { AttendanceRecord } from '../../src/domain'
import { describe, expect, test } from 'bun:test'
import { AttendanceStatus } from '../../src/domain'
import { SchoolNotificationTemplates } from '../../src/domain/messaging/school-notification-templates'
import { ATTENDANCE_RECORDED_EVENT_KEY, handleAttendanceRecorded } from '../../src/capabilities/notifications'
import { RecordingNotificationGateway } from '../../src/adapters'
import { buildDefaultNotificationTemplateDocument } from '../../src/capabilities/notifications/templates/defaults/manifest'
import { NotificationTemplateService } from '../../src/capabilities/notifications/templates/notification-template-service'

describe('enriched notification handlers', () => {
  test('handleAttendanceRecorded renders student, session, and class context', async () => {
    const gateway = new RecordingNotificationGateway()
    const templates = await buildDefaultNotificationTemplateDocument()
    const templateService = new NotificationTemplateService({
      schoolNotificationTemplates: {
        findById: async () => new SchoolNotificationTemplates({
          schoolId: 'sch1',
          templates,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
    } as any)

    await handleAttendanceRecorded({
      notificationGateway: gateway,
      templateService,
      actor: { schoolId: 'sch1' } as any,
      repositories: {
        schools: {
          findById: async () => ({
            id: 'sch1',
            name: 'Edaya School',
            timeZone: 'Africa/Douala',
          }),
        },
        students: {
          findById: async () => ({
            id: 'stu1',
            firstName: 'Léa',
            lastName: 'Martin',
          }),
        },
        sessions: {
          findById: async () => ({
            id: 'sess1',
            classGroupId: 'cg1',
            title: 'Mathematics',
            startsAt: new Date('2026-06-30T07:30:00.000Z'),
            endsAt: new Date('2026-06-30T08:30:00.000Z'),
          }),
        },
        classGroups: {
          findById: async () => ({
            id: 'cg1',
            name: '6ème A',
          }),
        },
        guardianLinks: {
          list: async () => [{ guardianId: 'gua1', studentId: 'stu1', receivesAttendanceAlerts: true }],
        },
        guardians: {
          findById: async () => ({
            id: 'gua1',
            schoolId: 'sch1',
            subjectId: 'subject-gua1',
            contactMethods: [],
          }),
        },
        messageDeliveries: {
          findById: async () => undefined,
          save: async () => {},
        },
      } as any,
    }, {
      schoolId: 'sch1',
      records: [{
        id: 'att1',
        studentId: 'stu1',
        sessionId: 'sess1',
        date: new Date('2026-06-30T07:30:00.000Z'),
        status: AttendanceStatus.Absent,
      }] as AttendanceRecord[],
    })

    expect(gateway.enqueued).toHaveLength(1)
    expect(gateway.enqueued[0]).toMatchObject({
      eventKey: ATTENDANCE_RECORDED_EVENT_KEY,
      title: 'Léa Martin — Absent',
    })
    expect(gateway.enqueued[0]?.body).toContain('Mathematics')
    expect(gateway.enqueued[0]?.body).toContain('6ème A')
  })
})
