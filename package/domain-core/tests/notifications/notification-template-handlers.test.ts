import { describe, expect, test } from 'bun:test'
import { RecordingNotificationGateway } from '../../src/adapters'
import {
  ANNOUNCEMENT_PUBLISHED_EVENT_KEY,
  ASSESSMENT_RESULT_RECORDED_EVENT_KEY,
  handleAnnouncementPublished,
  handleAssessmentResultRecorded,
  handleIncidentRecorded,
  handleReportCardPublished,
  INCIDENT_RECORDED_EVENT_KEY,
  REPORT_CARD_PUBLISHED_EVENT_KEY,
} from '../../src/capabilities/notifications'
import { buildDefaultNotificationTemplateDocument } from '../../src/capabilities/notifications/templates/defaults/manifest'
import { NotificationTemplateService } from '../../src/capabilities/notifications/templates/notification-template-service'
import {
  Announcement,
  AnnouncementPriority,
  Assessment,
  AssessmentKind,
  AssessmentResult,
  IncidentInvolvementRole,
  IncidentKind,
  IncidentStatus,
  MessageDelivery,
  MessageDeliveryRecipientKind,
  ReportCardResult,
  ReportCardResultStatus,
  Student,
} from '../../src/domain'
import { SchoolNotificationTemplates } from '../../src/domain/messaging/school-notification-templates'

async function createHandlerTemplateService(): Promise<NotificationTemplateService> {
  const templates = await buildDefaultNotificationTemplateDocument()
  return new NotificationTemplateService({
    schoolNotificationTemplates: {
      findById: async () => new SchoolNotificationTemplates({
        schoolId: 'sch1',
        templates,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    },
  } as never)
}

function createHandlerRepositories() {
  return {
    schools: {
      findById: async () => ({ id: 'sch1', name: 'Edaya School', timeZone: 'UTC' }),
    },
    students: {
      findById: async (id: string) => ({
        id,
        schoolId: 'sch1',
        subjectId: 'subject-stu1',
        firstName: 'Noah',
        lastName: 'Martin',
      }),
    },
    guardianLinks: {
      list: async () => [{ guardianId: 'gua1', studentId: 'stu1', receivesAcademicReports: true }],
    },
    guardians: {
      findById: async () => ({
        id: 'gua1',
        schoolId: 'sch1',
        subjectId: 'subject-gua1',
        contactMethods: [],
      }),
    },
    classGroups: {
      findById: async () => ({ id: 'cg1', name: '6ème A' }),
    },
    academicPeriods: {
      findById: async () => ({ id: 'per1', name: 'Term 2' }),
    },
    classSubjects: {
      findById: async () => ({ id: 'cs1', subjectId: 'sub1' }),
    },
    subjects: {
      findById: async () => ({ id: 'sub1', name: 'Mathematics' }),
    },
    messageDeliveries: {
      findById: async () => undefined,
      save: async () => {},
    },
  }
}

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
    } as never)

    await handleIncidentRecorded({
      notificationGateway: gateway,
      templateService,
      actor: { schoolId: 'sch1' } as never,
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
      } as never,
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
        lessonSessionId: 'sess1',
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

  test('handleAnnouncementPublished enqueues one notification per materialized delivery', async () => {
    const gateway = new RecordingNotificationGateway()
    const templateService = await createHandlerTemplateService()
    const announcement = new Announcement({
      id: 'ann1',
      schoolId: 'sch1',
      title: 'School closure',
      content: 'School closed tomorrow due to weather.',
      createdBy: 'staff1',
      priority: AnnouncementPriority.Important,
      publishedAt: new Date('2026-06-01T00:00:00Z'),
    })

    await handleAnnouncementPublished({
      notificationGateway: gateway,
      templateService,
      actor: { schoolId: 'sch1' } as never,
      repositories: createHandlerRepositories() as never,
    }, {
      announcement,
      deliveries: [
        new MessageDelivery({
          id: 'delivery-ann1-gua1',
          schoolId: 'sch1',
          announcementId: 'ann1',
          subjectId: 'subject-gua1',
          recipientKind: MessageDeliveryRecipientKind.Guardian,
          recipientId: 'gua1',
          title: 'School closure',
          body: 'School closed tomorrow due to weather.',
        }),
      ],
    })

    expect(gateway.enqueued).toHaveLength(1)
    expect(gateway.enqueued[0]).toMatchObject({
      eventKey: ANNOUNCEMENT_PUBLISHED_EVENT_KEY,
      announcementId: 'ann1',
      priority: AnnouncementPriority.Important,
    })
    expect(gateway.enqueued[0]?.body).toContain('School closed tomorrow')
  })

  test('handleReportCardPublished notifies guardians who receive academic reports', async () => {
    const gateway = new RecordingNotificationGateway()
    const templateService = await createHandlerTemplateService()
    const student = new Student({
      id: 'stu1',
      schoolId: 'sch1',
      firstName: 'Noah',
      lastName: 'Martin',
      subjectId: 'subject-stu1',
    })

    await handleReportCardPublished({
      notificationGateway: gateway,
      templateService,
      actor: { schoolId: 'sch1' } as never,
      repositories: createHandlerRepositories() as never,
    }, {
      student,
      result: new ReportCardResult({
        id: 'rc1',
        reportCardDefinitionId: 'def1',
        studentId: 'stu1',
        classGroupId: 'cg1',
        periodId: 'per1',
        sectionResults: [],
        attendanceSummary: { presentCount: 20, absenceCount: 0, lateCount: 0 },
        assessmentResultCount: 4,
        status: ReportCardResultStatus.Published,
        publishedAt: new Date('2026-06-01T00:00:00Z'),
      }),
    })

    expect(gateway.enqueued.length).toBeGreaterThan(0)
    expect(gateway.enqueued[0]).toMatchObject({
      eventKey: REPORT_CARD_PUBLISHED_EVENT_KEY,
    })
    expect(gateway.enqueued[0]?.body).toContain('Term 2')
    expect(gateway.enqueued[0]?.body).toContain('6ème A')
  })

  test('handleAssessmentResultRecorded renders score context for guardians', async () => {
    const gateway = new RecordingNotificationGateway()
    const templateService = await createHandlerTemplateService()
    const student = new Student({
      id: 'stu1',
      schoolId: 'sch1',
      firstName: 'Noah',
      lastName: 'Martin',
      subjectId: 'subject-stu1',
    })

    await handleAssessmentResultRecorded({
      notificationGateway: gateway,
      templateService,
      actor: { schoolId: 'sch1' } as never,
      repositories: createHandlerRepositories() as never,
    }, {
      student,
      assessment: new Assessment({
        id: 'ass1',
        classGroupId: 'cg1',
        classSubjectId: 'cs1',
        periodId: 'per1',
        title: 'Math quiz',
        kind: AssessmentKind.Quiz,
        maxScore: 20,
        startsAt: new Date('2026-06-16T09:00:00Z'),
        endsAt: new Date('2026-06-16T10:00:00Z'),
      }),
      result: new AssessmentResult({
        id: 'res1',
        studentId: 'stu1',
        assessmentId: 'ass1',
        score: 18,
      }),
    })

    expect(gateway.enqueued.length).toBeGreaterThan(0)
    expect(gateway.enqueued[0]).toMatchObject({
      eventKey: ASSESSMENT_RESULT_RECORDED_EVENT_KEY,
    })
    expect(gateway.enqueued[0]?.body).toContain('Mathematics')
    expect(gateway.enqueued[0]?.body).toContain('18')
  })
})
