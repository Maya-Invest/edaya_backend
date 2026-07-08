import type { Activity, CalendarEvent } from '@edaya/core'
import { ActivityEnrollmentStatus, RecordingNotificationGateway, SchoolNotificationTemplates, StudentClassEnrollmentStatus } from '@edaya/core'
import { buildDefaultNotificationTemplateDocument } from '../../src/capabilities/notifications/templates/defaults/manifest'
import { NotificationTemplateService } from '../../src/capabilities/notifications/templates/notification-template-service'

export async function createReminderTemplateService(): Promise<NotificationTemplateService> {
  const templates = await buildDefaultNotificationTemplateDocument()
  return new NotificationTemplateService({
    schoolNotificationTemplates: {
      findById: async () => new SchoolNotificationTemplates({
        schoolId: 'school-1',
        templates,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    },
  } as never)
}

export function createReminderScanRepositories() {
  return {
    schools: {
      findById: async () => ({
        id: 'school-1',
        name: 'Edaya School',
        timeZone: 'Africa/Douala',
      }),
    },
    classGroups: {
      findById: async (id: string) => (
        id === 'cg1'
          ? {
              id: 'cg1',
              schoolId: 'school-1',
              name: '6ème A',
              academicYearId: 'y1',
              gradeLevelId: 'gl1',
            }
          : undefined
      ),
      list: async () => [],
    },
    enrollments: {
      list: async () => [{
        studentId: 'stu1',
        status: StudentClassEnrollmentStatus.Active,
      }],
    },
    guardianLinks: {
      list: async () => [{
        guardianId: 'gua1',
        studentId: 'stu1',
        receivesAcademicReports: true,
      }],
    },
    guardians: {
      findById: async () => ({
        id: 'gua1',
        schoolId: 'school-1',
        subjectId: 'subject-gua1',
        contactMethods: [{ allowsNotifications: true }],
      }),
    },
    students: {
      findById: async () => ({
        id: 'stu1',
        schoolId: 'school-1',
        subjectId: 'subject-stu1',
      }),
    },
    activityEnrollments: {
      list: async () => [{
        activityId: 'act1',
        studentId: 'stu1',
        status: ActivityEnrollmentStatus.Approved,
      }],
    },
    messageDeliveries: {
      findById: async () => undefined,
      save: async () => {},
    },
  }
}

export async function createReminderCronContext(options: {
  asOf: Date
  calendarEvents?: CalendarEvent[]
  activities?: Activity[]
}) {
  const gateway = new RecordingNotificationGateway()
  const templateService = await createReminderTemplateService()

  return {
    context: {
      asOf: options.asOf,
      actor: {
        kind: 'system' as const,
        systemId: 'cron',
        schoolId: 'school-1',
        requestId: 'cron:test',
        reason: 'test',
      },
      service: {
        baseService: {
          repositories: {
            ...createReminderScanRepositories(),
            calendarEvents: {
              list: async () => options.calendarEvents ?? [],
            },
            activities: {
              list: async () => options.activities ?? [],
            },
          },
          notificationGateway: gateway,
          templateService,
        },
      },
    } as never,
    gateway,
  }
}
