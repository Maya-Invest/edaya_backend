import { describe, expect, test } from 'bun:test'
import { IncidentInvolvementRole, IncidentKind, IncidentStatus } from '../../src/domains'
import { SchoolNotificationTemplates } from '../../src/domains/messaging/school-notification-templates'
import {
  handleIncidentRecorded,
  INCIDENT_RECORDED_EVENT_KEY,
  RecordingNotificationGateway,
} from '../../src/notifications'
import { buildDefaultNotificationTemplateDocument } from '../../src/notifications/templates/defaults/manifest'
import { NotificationTemplateService } from '../../src/notifications/templates/notification-template-service'

describe('templated notification handlers', () => {
  test('handleIncidentRecorded uses a patched school template document', async () => {
    const gateway = new RecordingNotificationGateway()
    const templates = await buildDefaultNotificationTemplateDocument()
    templates['incident.recorded'] = {
      email: {
        subject: 'Email: {{incidentTitle}}',
        body: '<p>Email body for {{incidentTitle}}</p>',
      },
      in_app: {
        subject: 'In-app: {{incidentTitle}}',
        body: 'In-app body for {{incidentTitle}}',
      },
    }

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

    await handleIncidentRecorded({
      notificationGateway: gateway,
      templateService,
      actor: { schoolId: 'sch1' } as any,
      repositories: {
        schools: {
          findById: async () => ({ id: 'sch1', name: 'Edaya School', timeZone: 'UTC' }),
        },
        students: {
          findById: async () => ({
            id: 'stu1',
            firstName: 'Noah',
            lastName: 'Martin',
          }),
        },
        guardianLinks: {
          list: async () => [{ guardianId: 'gua1', studentId: 'stu1' }],
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
      incident: {
        id: 'inc1',
        schoolId: 'sch1',
        title: 'Hall incident',
        description: 'Incident description',
        date: new Date('2026-05-01T10:00:00Z'),
        kind: IncidentKind.MinorInfraction,
        reporterId: 'user1',
        classGroupId: 'cg1',
        sessionId: 'sess1',
        status: IncidentStatus.Open,
        createdAt: new Date('2026-05-01T10:00:00Z'),
        updatedAt: new Date('2026-05-01T10:00:00Z'),
      } as any,
      involvement: {
        id: 'inv1',
        incidentId: 'inc1',
        studentId: 'stu1',
        role: IncidentInvolvementRole.Subject,
        createdAt: new Date('2026-05-01T10:00:00Z'),
      } as any,
    })

    expect(gateway.enqueued).toHaveLength(1)
    expect(gateway.enqueued[0]).toMatchObject({
      eventKey: INCIDENT_RECORDED_EVENT_KEY,
      title: 'In-app: Hall incident',
      body: 'In-app body for Hall incident',
      emailSubject: 'Email: Hall incident',
      emailBody: '<p>Email body for Hall incident</p>',
    })
  })
})
