import type { SchoolNotificationTemplates } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { buildDefaultNotificationTemplateDocument } from '../../../src/capabilities/notifications/templates/defaults/manifest'
import { mergeSchoolNotificationTemplateDocument } from '../../../src/capabilities/notifications/templates/merge-school-notification-templates'
import { seedSchoolNotificationTemplates } from '../../../src/capabilities/notifications/templates/seed-school-notification-templates'
import { createTestApp } from '../../support/create-test-app'

describe('NotificationTemplatesServiceWorkflow', () => {
  test('updateSchoolNotificationTemplates patches one template key', async () => {
    const { app: service, schoolRepositories: repositories } = await createTestApp()
    await seedSchoolNotificationTemplates(repositories, 'school')

    const updated = await service.commands.updateSchoolNotificationTemplates({
      schoolId: 'school',
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
    const { app: service, schoolRepositories: repositories } = await createTestApp()
    await seedSchoolNotificationTemplates(repositories, 'school')

    await service.commands.updateSchoolNotificationTemplates({
      schoolId: 'school',
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
      schoolId: 'school',
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
