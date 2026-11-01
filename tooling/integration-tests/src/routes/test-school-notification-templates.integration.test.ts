import type { SchoolNotificationTemplatesData } from '@edaya/core'
import { MINIMAL_AUTH_FIXTURE_STAFF_EMAIL } from '@edaya/fixtures/meta/dev-auth-fixtures'
import { SEED_SCHOOL_ID } from '@edaya/fixtures/shared/ids'
import { expect, it } from 'bun:test'
import { seedSchoolNotificationTemplates } from '../../../../package/domain-service/src/capabilities/notifications/templates/seed-school-notification-templates'
import { createInProcessSchoolClient } from '../support/in-process-school-client'
import { describeWithMinimalSchool } from '../support/minimal-route-test-context'

describeWithMinimalSchool('school notification templates HTTP', (getContext) => {
  it('gets flattened catalog, patches a dotted key, and resets that key', async () => {
    const { application, app, authHeaders } = getContext()
    const authorization = (await authHeaders(MINIMAL_AUTH_FIXTURE_STAFF_EMAIL)).authorization
    const client = createInProcessSchoolClient(app, { headers: { authorization } })

    await seedSchoolNotificationTemplates(application.repositories, SEED_SCHOOL_ID)
    const before = await client.entities.schoolNotificationTemplates.get(SEED_SCHOOL_ID) as SchoolNotificationTemplatesData

    expect(before).toMatchObject({
      schoolId: SEED_SCHOOL_ID,
      invitationSmsEnabled: false,
    })
    expect(before.announcementPublished.rich_message.body).toContain('<p>')
    expect(before.announcementPublished.base_message.body).toContain('{{announcementBodyShort}}')
    expect(before.accountInvitation.rich_message.body.length).toBeGreaterThan(0)
    expect(before.incidentRecorded.simple_message.body.length).toBeGreaterThan(0)

    const originalIncidentTitle = before.incidentRecorded.base_message.title

    const updated = await client.commands.updateSchoolNotificationTemplates({
      schoolId: SEED_SCHOOL_ID,
      invitationSmsEnabled: true,
      templates: {
        'incident.recorded': {
          enable_email: false,
          enable_push: true,
          enable_sms: true,
          base_message: {
            title: 'HTTP custom incident',
            body: 'HTTP custom body',
          },
          rich_message: {
            subject: 'HTTP custom subject',
            body: '<p>HTTP custom html</p>',
          },
          simple_message: {
            body: 'HTTP custom sms',
          },
        },
      },
    }) as SchoolNotificationTemplatesData

    expect(updated.invitationSmsEnabled).toBe(true)
    expect(updated.incidentRecorded).toMatchObject({
      enable_email: false,
      enable_push: true,
      enable_sms: true,
      base_message: {
        title: 'HTTP custom incident',
        body: 'HTTP custom body',
      },
      rich_message: {
        subject: 'HTTP custom subject',
        body: '<p>HTTP custom html</p>',
      },
      simple_message: {
        body: 'HTTP custom sms',
      },
    })
    expect(updated.announcementPublished.base_message.title).toBe(before.announcementPublished.base_message.title)

    const fetched = await client.entities.schoolNotificationTemplates.get(SEED_SCHOOL_ID) as SchoolNotificationTemplatesData
    expect(fetched.invitationSmsEnabled).toBe(true)
    expect(fetched.incidentRecorded.base_message.title).toBe('HTTP custom incident')
    expect(fetched.incidentRecorded.rich_message.body).toBe('<p>HTTP custom html</p>')

    const reset = await client.commands.resetSchoolNotificationTemplates({
      schoolId: SEED_SCHOOL_ID,
      templateKey: 'incident.recorded',
    }) as SchoolNotificationTemplatesData

    expect(reset.incidentRecorded.base_message.title).toBe(originalIncidentTitle)
    expect(reset.invitationSmsEnabled).toBe(true)
    expect(reset.incidentRecorded.rich_message.body).toContain('<p>')
  })
})
