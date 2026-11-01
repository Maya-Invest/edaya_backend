import type { Activity, Assessment, CalendarEvent } from '@edaya/core'
import { ActivityCategory, AssessmentKind, CalendarEventKind, CalendarEventScopeKind, RecordingNotificationGateway, SchoolNotificationTemplates, StudentClassEnrollmentStatus, StudentSubjectEnrollment } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import {
  activityReminderTrigger,
  assessmentDueSoonTrigger,
  calendarEventReminderTrigger,
} from '../../src/capabilities/notifications'
import { buildDefaultNotificationTemplateDocument } from '../../src/capabilities/notifications/templates/defaults/manifest'
import { NotificationTemplateService } from '../../src/capabilities/notifications/templates/notification-template-service'

async function createDefaultTemplateService(): Promise<NotificationTemplateService> {
  const templates = await buildDefaultNotificationTemplateDocument()
  return new NotificationTemplateService({
    schoolNotificationTemplates: {
      findById: async () => new SchoolNotificationTemplates({
        schoolId: 'sch1',
        ...templates,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    },
  } as any)
}

const schoolRepositories = {
  schools: {
    findById: async () => ({
      id: 'sch1',
      name: 'Edaya School',
      timeZone: 'Africa/Douala',
    }),
  },
  classGroups: {
    findById: async () => ({
      id: 'cg1',
      schoolId: 'sch1',
      name: '6ème A',
    }),
    list: async () => [],
  },
  gradeLevels: {
    findById: async () => ({
      id: 'gl1',
      name: '6ème',
    }),
  },
  classSubjects: {
    findById: async () => ({
      id: 'cs1',
      subjectId: 'sub1',
    }),
  },
  subjects: {
    findById: async () => ({
      id: 'sub1',
      name: 'Mathematics',
    }),
  },
  subjectEnrollments: { list: async () => [new StudentSubjectEnrollment({ id: 'choice', studentClassEnrollmentId: 'p1', classSubjectId: 'cs1', enrolledAt: new Date('2026-01-01'), source: 'automatic' })] },
  enrollments: {
    list: async () => [
      { id: 'p1', studentId: 'stu1', enrolledAt: new Date('2026-01-01'), status: StudentClassEnrollmentStatus.Active },
    ],
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
      schoolId: 'sch1',
      subjectId: 'subject-gua1',
      hasAccess: true,
    }),
  },
  activityEnrollments: {
    list: async () => [{
      studentId: 'stu1',
      status: 'approved',
    }],
  },
  students: {
    findById: async () => ({
      id: 'stu1',
      schoolId: 'sch1',
      subjectId: 'subject-stu1',
    }),
  },
}

describe('enriched notification triggers', () => {
  test('assessmentDueSoonTrigger renders subject, class, and formatted due date for homework', async () => {
    const gateway = new RecordingNotificationGateway()
    const templateService = await createDefaultTemplateService()
    const entity = {
      id: 'hw1',
      classGroupId: 'cg1',
      classSubjectId: 'cs1',
      periodId: 'p1',
      title: 'Chapter 5 exercises',
      kind: AssessmentKind.Homework,
      maxScore: 20,
      coefficient: 1,
      dueAt: new Date('2026-06-20T00:00:00.000Z'),
      createdAt: new Date('2026-06-01T00:00:00Z'),
    } as Assessment

    const input = await assessmentDueSoonTrigger.resolver(entity, undefined, {
      notificationGateway: gateway,
      templateService,
      actor: { schoolId: 'sch1' } as any,
      repositories: schoolRepositories as any,
    })

    expect(input).not.toBeNull()
    expect(input?.title).toBe('Chapter 5 exercises due sam. 20 juin 2026')
    expect(input?.body).toContain('Mathematics')
    expect(input?.body).toContain('6ème A')
  })

  test('activityReminderTrigger renders schedule and coach', async () => {
    const gateway = new RecordingNotificationGateway()
    const templateService = await createDefaultTemplateService()
    const entity = {
      id: 'act1',
      schoolId: 'sch1',
      name: 'Basketball club',
      category: ActivityCategory.Sport,
      coach: 'Coach Dupont',
      schedule: 'Tuesdays 4–6pm',
      participants: 10,
      capacity: 20,
      description: 'Weekly practice',
      startDate: new Date('2027-01-15T00:00:00.000Z'),
      endDate: new Date('2027-06-30T00:00:00.000Z'),
    } as Activity

    const input = await activityReminderTrigger.resolver(entity, undefined, {
      notificationGateway: gateway,
      templateService,
      actor: { schoolId: 'sch1' } as any,
      repositories: schoolRepositories as any,
    })

    expect(input).not.toBeNull()
    expect(input?.title).toBe('Reminder: Basketball club')
    expect(input?.body).toContain('Tuesdays 4–6pm')
    expect(input?.body).toContain('Coach Dupont')
  })

  test('calendarEventReminderTrigger renders date range and scope', async () => {
    const gateway = new RecordingNotificationGateway()
    const templateService = await createDefaultTemplateService()
    const entity = {
      id: 'evt1',
      schoolId: 'sch1',
      academicYearId: 'y1',
      title: 'Science fair',
      description: 'Annual fair',
      startDate: new Date('2027-03-01T00:00:00.000Z'),
      endDate: new Date('2027-03-03T00:00:00.000Z'),
      kind: CalendarEventKind.Event,
      scopeKind: CalendarEventScopeKind.ClassGroup,
      scopeId: 'cg1',
    } as CalendarEvent

    const input = await calendarEventReminderTrigger.resolver(entity, undefined, {
      notificationGateway: gateway,
      templateService,
      actor: { schoolId: 'sch1' } as any,
      repositories: schoolRepositories as any,
    })

    expect(input).not.toBeNull()
    expect(input?.title).toBe('Reminder: Science fair')
    expect(input?.body).toContain('6ème A')
    expect(input?.recipients?.length).toBeGreaterThan(0)
  })
})
