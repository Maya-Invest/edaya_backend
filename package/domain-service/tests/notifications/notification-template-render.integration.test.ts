import { SchoolNotificationTemplates } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import {
  buildDefaultNotificationTemplateDocument,
} from '../../src/capabilities/notifications/templates/defaults/manifest'
import { NotificationTemplateService } from '../../src/capabilities/notifications/templates/notification-template-service'
import { renderTemplateString } from '../../src/capabilities/notifications/templates/render'
import { seedSchoolNotificationTemplates } from '../../src/capabilities/notifications/templates/seed-school-notification-templates'
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
      ...templates,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))

    const service = new NotificationTemplateService({ schoolNotificationTemplates: store })
    const rendered = await service.render({
      schoolId: 'school-1',
      templateKey: 'report_card.published',
      channel: 'in_app',
      variables: {
        studentName: 'Ada Lovelace',
        periodName: 'Term 2',
        classGroupName: '6ème A',
      },
    })

    expect(rendered.subject).toBe('Report card — Ada Lovelace')
    expect(rendered.body).toBe('Term 2 results for 6ème A are available.')
  })

  test('renders account_invitation from platform defaults when the school row is missing', async () => {
    const service = new NotificationTemplateService({
      schoolNotificationTemplates: {
        findById: async () => undefined,
      },
    } as any)

    const rendered = await service.render({
      schoolId: 'school-1',
      templateKey: 'account_invitation',
      channel: 'email',
      variables: {
        inviteeName: 'Paul Martin',
        schoolName: 'EDaya Central',
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
    expect(rows[0]?.announcementPublished.rich_message.body).toContain('{{announcementBody}}')
  })

  test('keeps custom event copy when backfilling defaults', async () => {
    const defaults = await buildDefaultNotificationTemplateDocument()
    const custom = {
      ...defaults,
      announcementPublished: {
        ...defaults.announcementPublished,
        rich_message: { subject: 'Custom', body: '<p>Custom {{announcementBody}}</p>' },
      },
    }
    const saved: SchoolNotificationTemplates[] = []
    const repositories = {
      schoolNotificationTemplates: {
        findById: async () => new SchoolNotificationTemplates({
          schoolId: 'school-1',
          ...custom,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        }),
        save: async (entity: SchoolNotificationTemplates) => {
          saved.push(entity)
        },
      },
    } as any

    await seedSchoolNotificationTemplates(repositories, 'school-1')

    expect(saved).toHaveLength(0)
  })
})
