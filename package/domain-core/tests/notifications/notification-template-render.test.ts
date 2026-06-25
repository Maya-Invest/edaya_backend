import { describe, expect, test } from 'bun:test'
import { SchoolNotificationTemplates } from '../../src/domains/messaging/school-notification-templates'
import {
  buildDefaultNotificationTemplateDocument,
} from '../../src/notifications/templates/defaults/manifest'
import { NotificationTemplateService } from '../../src/notifications/templates/notification-template-service'
import { renderTemplateString } from '../../src/notifications/templates/render'
import { seedSchoolNotificationTemplates } from '../../src/notifications/templates/seed-school-notification-templates'
import { createStore } from '../support/create-test-app'

describe('notification template render', () => {
  test('substitutes known variables and leaves unknown placeholders', () => {
    expect(renderTemplateString(
      'Hello {{studentName}}, due {{dueDate}}',
      { studentName: 'Ada' },
    )).toBe('Hello Ada, due {{dueDate}}')
  })

  test('renders a school document slice through NotificationTemplateService', async () => {
    const store = createStore<SchoolNotificationTemplates>([])
    const templates = await buildDefaultNotificationTemplateDocument()
    await store.save(new SchoolNotificationTemplates({
      schoolId: 'school-1',
      templates,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))

    const service = new NotificationTemplateService({ schoolNotificationTemplates: store })
    const rendered = await service.render({
      schoolId: 'school-1',
      templateKey: 'report_card.published',
      channel: 'in_app',
      variables: { studentName: 'Ada Lovelace' },
    })

    expect(rendered.subject).toBe('Report card published')
    expect(rendered.body).toBe('The report card for Ada Lovelace is now available.')
  })

  test('renders account_invitation from platform defaults when school row is missing that key', async () => {
    const full = await buildDefaultNotificationTemplateDocument()
    const legacy = Object.fromEntries(
      Object.entries(full).filter(([key]) => key !== 'account_invitation'),
    ) as typeof full

    const service = new NotificationTemplateService({
      schoolNotificationTemplates: {
        findById: async () => ({
          schoolId: 'school-1',
          templates: legacy,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
    })

    const rendered = await service.render({
      schoolId: 'school-1',
      templateKey: 'account_invitation',
      channel: 'email',
      variables: {
        inviteeName: 'Paul Martin',
        schoolName: 'Edaya Central',
        inviteUrl: 'https://app.edaya.test/invite/token',
        expiresAt: '2026-07-01T00:00:00.000Z',
        actorKind: 'staff',
      },
    })

    expect(rendered.body).toContain('https://app.edaya.test/invite/token')
    expect(rendered.body).toContain('Paul Martin')
  })
})

describe('seedSchoolNotificationTemplates', () => {
  test('inserts defaults once and is idempotent', async () => {
    const store = createStore<SchoolNotificationTemplates>([])
    const repositories = { schoolNotificationTemplates: store }

    await seedSchoolNotificationTemplates(repositories, 'school-1')
    await seedSchoolNotificationTemplates(repositories, 'school-1')

    const rows = await store.list()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.schoolId).toBe('school-1')
    expect(rows[0]?.templates['announcement.published'].email?.body).toContain('{{announcementBody}}')
  })

  test('backfills missing template keys on existing school rows', async () => {
    const defaults = await buildDefaultNotificationTemplateDocument()
    const legacy = Object.fromEntries(
      Object.entries(defaults).filter(([key]) => key !== 'account_invitation'),
    ) as typeof defaults
    const saved: SchoolNotificationTemplates[] = []
    const repositories = {
      schoolNotificationTemplates: {
        findById: async () => ({
          schoolId: 'school-1',
          templates: legacy,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        }),
        save: async (entity: SchoolNotificationTemplates) => {
          saved.push(entity)
        },
      },
    }

    await seedSchoolNotificationTemplates(repositories, 'school-1')

    expect(saved).toHaveLength(1)
    expect(saved[0]?.templates.account_invitation.email?.body).toContain('{{inviteUrl}}')
  })
})
