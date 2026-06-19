import {
  countSeedAnnouncements,
  countSeedAnnouncementTargets,
  countSeedAttachments,
  countSeedDisciplinaryActions,
  countSeedMessageDeliveriesMinimum,
  countSeedStudentDisciplinaryActions,
  DEV_AUTH_PASSWORD,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
} from '@edaya/dev-fixtures'
import { createHandlerAuthProvisioner, runDevAccessSeed, runDevAuthLink, runDevSchoolSeed } from '@edaya/seeding'
import { afterEach, describe, expect, it } from 'bun:test'
import { resetApiRuntimesForTests } from '@/runtime'
import { apiPgliteEnv } from '../support/api-pglite-env'

import {
  collectSetCookieHeaders,
  createAppRequest,
  createCoreRouteTestApp,
} from '../support/api-route-harness'

function unwrapEntityList<T>(values: unknown): T[] {
  if (!Array.isArray(values)) {
    return []
  }
  return values.map((entry) => {
    if (entry && typeof entry === 'object' && 'data' in entry && Object.keys(entry).length === 1) {
      return (entry as { data: T }).data
    }
    return entry as T
  })
}

describe('dev communications discipline attachments seed', () => {
  afterEach(async () => {
    await resetApiRuntimesForTests()
  })

  it('seeds announcements, discipline catalog, attachments and lets staff list entities', async () => {
    const { app, runtime, application } = await createCoreRouteTestApp()
    const seedResult = await runDevSchoolSeed(application)
    expect(seedResult.status).toBe('seeded')
    if (seedResult.status === 'seeded') {
      expect(seedResult.announcements).toBe(countSeedAnnouncements())
      expect(seedResult.announcementTargets).toBe(countSeedAnnouncementTargets())
      expect(seedResult.messageDeliveries).toBeGreaterThanOrEqual(countSeedMessageDeliveriesMinimum())
      expect(seedResult.disciplinaryActions).toBe(countSeedDisciplinaryActions())
      expect(seedResult.studentDisciplinaryActions).toBe(countSeedStudentDisciplinaryActions())
      expect(seedResult.attachments).toBe(countSeedAttachments())
    }

    await runDevAuthLink(application, createHandlerAuthProvisioner(runtime.getAuth(), apiPgliteEnv.BETTER_AUTH_URL))
    await runDevAccessSeed(application)

    const signIn = await app.request(createAppRequest('/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: MINIMAL_AUTH_FIXTURE_STAFF_EMAIL, password: DEV_AUTH_PASSWORD }),
    }))
    const cookies = collectSetCookieHeaders(signIn)
    const authHeaders = {
      'content-type': 'application/json',
      'cookie': cookies.join('; '),
    }

    const [
      announcementsResponse,
      deliveriesResponse,
      disciplinaryActionsResponse,
      studentDisciplinaryActionsResponse,
      attachmentsResponse,
    ] = await Promise.all([
      app.request(createAppRequest('/core/entities/announcements/list', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest('/core/entities/message-deliveries/list', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest('/core/entities/disciplinary-actions/list', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest('/core/entities/student-disciplinary-actions/list', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest('/core/entities/attachments/list', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({}),
      })),
    ])

    expect(announcementsResponse.status).toBe(200)
    expect(deliveriesResponse.status).toBe(200)
    expect(disciplinaryActionsResponse.status).toBe(200)
    expect(studentDisciplinaryActionsResponse.status).toBe(200)
    expect(attachmentsResponse.status).toBe(200)

    const announcements = unwrapEntityList<{ id: string, title: string, status: string }>(await announcementsResponse.json())
    const deliveries = unwrapEntityList<{ id: string, announcementId: string, status: string }>(await deliveriesResponse.json())
    const disciplinaryActions = unwrapEntityList<{ id: string, name: string, kind: string }>(await disciplinaryActionsResponse.json())
    const studentDisciplinaryActions = unwrapEntityList<{ id: string, incidentId: string, status: string }>(await studentDisciplinaryActionsResponse.json())
    const attachments = unwrapEntityList<{ id: string, ownerKind: string, fileName: string }>(await attachmentsResponse.json())

    expect(announcements.length).toBeGreaterThanOrEqual(countSeedAnnouncements())
    expect(deliveries.length).toBeGreaterThanOrEqual(countSeedMessageDeliveriesMinimum())
    expect(disciplinaryActions.length).toBeGreaterThanOrEqual(countSeedDisciplinaryActions())
    expect(studentDisciplinaryActions.length).toBeGreaterThanOrEqual(countSeedStudentDisciplinaryActions())
    expect(attachments.length).toBeGreaterThanOrEqual(countSeedAttachments())

    expect(announcements.some(entry => entry.id === 'ann-rentree' && entry.status === 'published')).toBe(true)
    expect(announcements.some(entry => entry.id === 'ann-draft-fete' && entry.status === 'draft')).toBe(true)
    expect(deliveries.some(entry => entry.id === 'md-parent-g1-read' && entry.status === 'read')).toBe(true)
    expect(disciplinaryActions.some(entry => entry.id === 'da-detention' && entry.kind === 'sanction')).toBe(true)
    expect(studentDisciplinaryActions.some(entry => entry.id === 'sda-i2-s2' && entry.status === 'completed')).toBe(true)
    expect(attachments.some(entry => entry.id === 'att-hp-s3-plan' && entry.fileName === 'peanut_allergy_plan.pdf')).toBe(true)
  }, 30_000)
})
