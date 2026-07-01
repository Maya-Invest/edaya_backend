import type { SchoolNotificationTemplates } from '../../../src/domain/messaging/school-notification-templates'
import { describe, expect, test } from 'bun:test'
import { noOpNotificationGateway } from '../../../src/adapters'
import { SchoolService } from '../../../src/application'
import { createRepositoryAuthorizationPolicy } from '../../../src/capabilities/authorization/policy/repository-policy'
import { buildDefaultNotificationTemplateDocument } from '../../../src/capabilities/notifications/templates/defaults/manifest'
import { mergeSchoolNotificationTemplateDocument } from '../../../src/capabilities/notifications/templates/merge-school-notification-templates'
import { seedSchoolNotificationTemplates } from '../../../src/capabilities/notifications/templates/seed-school-notification-templates'
import { createStore } from '../../support/create-test-app'
import { createElevatedTestStaffActor } from '../../support/elevated-test-actor'
import { testFileStorage } from '../../support/test-file-storage'

describe('NotificationTemplatesServiceWorkflow', () => {
  test('updateSchoolNotificationTemplates patches one template key', async () => {
    const store = createStore<SchoolNotificationTemplates>([])
    const repositories = {
      schoolNotificationTemplates: store,
    } as any

    await seedSchoolNotificationTemplates(repositories, 'sch1')

    const actor = createElevatedTestStaffActor('sch1', 'admin')
    const service = new SchoolService({
      actor,
      repositories,
      authorizationPolicy: createRepositoryAuthorizationPolicy({
        repositories,
        staffAssignmentRepository: { findById: async () => undefined, list: async () => [] },
        staffMemberRepository: { findById: async () => undefined, list: async () => [] },
        guardianRepository: { findById: async () => undefined, list: async () => [] },
        guardianStudentLinkRepository: { list: async () => [] },
        studentRepository: { findById: async () => undefined, list: async () => [] },
      } as any),
      atomicExecution: { execute: operation => operation() },
      notificationGateway: noOpNotificationGateway,
      fileStorage: testFileStorage,
    })

    const updated = await service.commands.updateSchoolNotificationTemplates({
      schoolId: 'sch1',
      templates: {
        'incident.recorded': {
          in_app: {
            subject: 'Custom incident',
            body: 'Custom incident body',
          },
        },
      },
    }) as SchoolNotificationTemplates

    expect(updated.templates['incident.recorded'].in_app?.subject).toBe('Custom incident')
    expect(updated.templates['announcement.published'].email?.body).toContain('{{announcementBody}}')
  })

  test('resetSchoolNotificationTemplates restores one key from defaults', async () => {
    const store = createStore<SchoolNotificationTemplates>([])
    const repositories = {
      schoolNotificationTemplates: store,
    } as any

    await seedSchoolNotificationTemplates(repositories, 'sch1')
    const actor = createElevatedTestStaffActor('sch1', 'admin')
    const service = new SchoolService({
      actor,
      repositories,
      authorizationPolicy: createRepositoryAuthorizationPolicy({
        repositories,
        staffAssignmentRepository: { findById: async () => undefined, list: async () => [] },
        staffMemberRepository: { findById: async () => undefined, list: async () => [] },
        guardianRepository: { findById: async () => undefined, list: async () => [] },
        guardianStudentLinkRepository: { list: async () => [] },
        studentRepository: { findById: async () => undefined, list: async () => [] },
      } as any),
      atomicExecution: { execute: operation => operation() },
      notificationGateway: noOpNotificationGateway,
      fileStorage: testFileStorage,
    })

    await service.commands.updateSchoolNotificationTemplates({
      schoolId: 'sch1',
      templates: {
        'incident.recorded': {
          in_app: {
            subject: 'Custom incident',
            body: 'Custom incident body',
          },
        },
      },
    })

    const defaults = await buildDefaultNotificationTemplateDocument()
    const reset = await service.commands.resetSchoolNotificationTemplates({
      schoolId: 'sch1',
      templateKey: 'incident.recorded',
    }) as SchoolNotificationTemplates

    expect(reset.templates['incident.recorded']).toEqual(defaults['incident.recorded'])
  })
})

describe('mergeSchoolNotificationTemplateDocument', () => {
  test('validates merged document shape', async () => {
    const defaults = await buildDefaultNotificationTemplateDocument()
    const merged = mergeSchoolNotificationTemplateDocument(defaults, {
      'assessment.due_soon': {
        email: {
          subject: 'Due soon: {{assessmentTitle}}',
        },
      },
    })

    expect(merged['assessment.due_soon'].email?.subject).toBe('Due soon: {{assessmentTitle}}')
    expect(merged['assessment.due_soon'].email?.body).toBe(defaults['assessment.due_soon'].email?.body)
  })
})
